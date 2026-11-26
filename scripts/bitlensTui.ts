import { emitKeypressEvents, type Key } from 'node:readline'
import { stdin, stdout } from 'node:process'
import type { Change, Commit, Params, Results, Service } from '../shared/types'
import { openTerminalRepository } from './terminalRepository'
import { drawScreen, pageSize, terminal, type Pane } from './tuiScreen'

const short = (value: string) => value.slice(0, 8)
const head = (commit: Commit) => commit.message.split('\n')[0]

type Position = { pane: Pane; index: number }

export async function runTui(options: { repo?: string; example?: boolean; revision?: string }) {
  if (process.platform !== 'linux') throw new Error('Run the TUI from Linux or WSL.')
  if (!stdin.isTTY || !stdout.isTTY || !process.env.TERM || process.env.TERM === 'dumb')
    throw new Error('The TUI needs an interactive terminal. For output you can pipe, use graph, compare, file, or tree.')

  const shutdown = new AbortController()
  const service: Service = options.example
    ? (await import('../web/src/example')).exampleService
    : (await openTerminalRepository(options.repo, { paginate: true, signal: shutdown.signal })).service
  const repository = await service('bootstrap')
  const start = options.revision || repository.defaultBranch
  let graphRevision = repository.refs.find((ref) => ref.name === start)?.hash || start || repository.refs[0]?.hash || ''
  let base: string | undefined
  let target: string | undefined
  let message = ''
  let busy = false
  let closed = false
  let position: Position = { pane: { tab: 'Commits', title: 'Commit graph', rows: [] }, index: 0 }
  const trail: Position[] = []

  function render() {
    if (closed) return
    stdout.write(drawScreen({
      ...position, width: stdout.columns, height: stdout.rows,
      repo: repository.workspace + '/' + repository.repo,
      base, target, graph: graphRevision, busy, message,
      colorDepth: Object.hasOwn(process.env, 'NO_COLOR') ? 1 : stdout.getColorDepth(),
    }))
  }

  function refs(): Pane {
    return {
      tab: 'Refs',
      title: 'Branches and tags',
      note: repository.partial ? 'Bitbucket returned a partial ref list' : undefined,
      rows: repository.refs.map((ref) => ({
        label: ref.name, hash: ref.hash, meta: ref.kind + ' · ' + short(ref.hash),
        detail: [ref.hash],
        open: async () => {
          const pane = await commits(ref.hash)
          graphRevision = ref.hash
          return pane
        },
      })),
    }
  }

  async function commits(revision: string, cursor?: string, previous: Commit[] = []): Promise<Pane> {
    if (!revision) return refs()
    const result = await service('graph', { base: revision, target: revision, cursor })
    const list = [...new Map([...previous, ...result.commits].map((commit) => [commit.hash, commit])).values()]
    return {
      tab: 'Commits',
      title: 'Commit graph · ' + short(revision),
      rows: list.map((commit) => ({
        label: (commit.parents.length > 1 ? '◆ ' : '● ') + short(commit.hash) + '  ' + head(commit),
        hash: commit.hash,
        detail: [
          commit.author + ' · ' + commit.date.slice(0, 10),
          commit.parents.length ? 'Parents  ' + commit.parents.map(short).join(' · ') : 'Root commit',
        ],
        open: () => compareRevision(base ?? commit.parents[0], commit.hash),
      })),
      next: result.next ? () => commits(revision, result.next, list) : undefined,
    }
  }

  function compareRevision(baseline: string | undefined, selected: string) {
    if (!baseline) throw new Error('This commit has no parent. Pin a baseline with b first.')
    if (baseline === selected) throw new Error('Pick a different baseline and target.')
    return compare(baseline, selected)
  }

  async function compare(baseline: string, selected: string, cursor?: string, previous: Change[] = []): Promise<Pane> {
    const result = await service('compare', { base: baseline, target: selected, cursor })
    const changes = [...previous, ...result.changes]
    return {
      tab: 'Compare',
      title: 'Changed files · ' + short(result.base) + ' → ' + short(result.target),
      note: changes.length + (changes.length === 1 ? ' file' : ' files'),
      rows: changes.map((file) => {
        const path = file.newPath || file.oldPath || ''
        const renamed = file.oldPath && file.newPath && file.oldPath !== file.newPath
        return {
          label: renamed ? file.oldPath + ' → ' + file.newPath : path,
          meta: '+' + file.added + ' / −' + file.removed,
          detail: [file.status + ' · ' + path, 'Enter opens the patch and file history.'],
          open: () => patch({
            base: result.base, target: result.target, path,
            oldPath: renamed ? file.oldPath! : undefined, deleted: !file.newPath,
          }),
        }
      }),
      next: result.next ? () => compare(result.base, result.target, result.next, changes) : undefined,
    }
  }

  async function patch(params: Params, cursor?: string, previous?: Results['detail']): Promise<Pane> {
    const page = await service('detail', { ...params, cursor })
    const result = previous ? {
      ...page, diff: previous.diff, history: [...previous.history, ...page.history],
      warning: page.warning || previous.warning,
    } : page
    const count = result.history.length
    return {
      tab: 'Compare',
      title: 'Patch · ' + params.path,
      note: result.warning || 'Enter on a history row to open its commit',
      next: result.next ? () => patch(params, result.next, result) : undefined,
      rows: [
        { label: 'File history · ' + count + (result.next ? '+' : '') + ' revisions', tone: 'accent' },
        ...result.history.map((revision) => ({
          label: short(revision.hash) + '  ' + revision.path,
          detail: [revision.message.split('\n')[0], revision.pr ? 'PR #' + revision.pr.id + ' · ' + revision.pr.title : revision.author],
          open: () => commits(revision.hash),
        })),
        { label: 'Patch', tone: 'accent' },
        ...result.diff.split('\n').map((label) => ({
          label: label.replaceAll('\t', '    '),
          tone: label.startsWith('@@') ? 'accent' as const : label.startsWith('-') ? 'muted' as const : undefined,
        })),
      ],
    }
  }

  async function source(revision: string, directory = '', cursor?: string, previous: Results['tree']['entries'] = []): Promise<Pane> {
    if (!revision) return refs()
    const result = await service('tree', { target: revision, path: directory, cursor })
    const entries = [...previous, ...result.entries]
    return {
      tab: 'Source',
      title: 'Source · ' + short(revision) + ' /' + directory,
      rows: entries.map((entry) => ({
        label: (entry.directory ? '▸ ' : '· ') + entry.path.split('/').at(-1) + (entry.directory ? '/' : ''),
        detail: [entry.path, entry.directory ? 'Enter opens this directory.' : entry.url],
        open: entry.directory ? () => source(revision, entry.path) : undefined,
      })),
      next: result.next ? () => source(revision, directory, result.next, entries) : undefined,
    }
  }

  function help(): Pane {
    return {
      tab: 'Help',
      title: 'Keys',
      rows: [
        { label: '1 / 2 / 3 / 4   Commits, refs, compare, source' },
        { label: '↑ / ↓ or j / k  Move; Home and End jump' },
        { label: 'Enter           Open the selected row' },
        { label: 'b / t           Pin the selected commit or ref' },
        { label: 'c               Compare the pinned revisions' },
        { label: 'n               Load more rows when available' },
        { label: 'Esc             Go back; q or Ctrl+C quits' },
      ],
    }
  }

  async function open(load: () => Pane | Promise<Pane>, mode: 'push' | 'replace' = 'push') {
    const previous = position
    busy = true
    message = ''
    render()
    try {
      const pane = await load()
      if (closed) return
      if (mode === 'push') {
        trail.push(previous)
        if (trail.length > 50) trail.shift()
      }
      position = { pane, index: mode === 'push' ? 0 : previous.index }
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    } finally {
      busy = false
      render()
    }
  }

  function move(index: number) {
    position = { ...position, index: Math.max(0, Math.min(index, position.pane.rows.length - 1)) }
    message = ''
  }

  return new Promise<void>((resolve) => {
    const wasRaw = stdin.isRaw
    const quit = () => {
      if (closed) return
      closed = true
      shutdown.abort()
      stdin.off('keypress', handle)
      stdout.off('resize', render)
      process.off('SIGTERM', quit)
      process.off('SIGHUP', quit)
      process.off('SIGINT', quit)
      process.off('exit', restore)
      restore()
      stdin.pause()
      resolve()
    }
    const restore = () => {
      stdin.setRawMode(wasRaw)
      stdout.write(terminal.leave)
    }
    function handle(input: string, key: Key) {
      if (input === 'q' || (key.ctrl && key.name === 'c')) return quit()
      if (busy || key.ctrl || key.meta) return
      const { pane, index } = position
      const row = pane.rows[index]
      if (input === '?') void open(help)
      else if (input === '1') void open(() => commits(graphRevision))
      else if (input === '2') void open(refs)
      else if (input === '3' || input === 'c') {
        const selected = target ?? row?.hash
        if (!selected || !base) message = 'Pin a baseline with b and a target with t.'
        else void open(() => compareRevision(base, selected))
      } else if (input === '4') void open(() => source(target || graphRevision))
      else if ((input === 'b' || input === 't') && row?.hash) {
        if (input === 'b') base = row.hash
        else target = row.hash
        message = (input === 'b' ? 'Baseline' : 'Target') + ' pinned at ' + short(row.hash) + '.'
      } else if (input === 'n' && pane.next) void open(pane.next, 'replace')
      else if (key.name === 'return' && row?.open) void open(row.open)
      else if (key.name === 'escape' && trail.length) {
        position = trail.pop()!
        message = ''
      } else if (key.name === 'up' || input === 'k') move(index - 1)
      else if (key.name === 'down' || input === 'j') move(index + 1)
      else if (key.name === 'pageup') move(index - pageSize(stdout.rows))
      else if (key.name === 'pagedown') move(index + pageSize(stdout.rows))
      else if (key.name === 'home') move(0)
      else if (key.name === 'end') move(pane.rows.length - 1)
      render()
    }

    emitKeypressEvents(stdin)
    stdin.setRawMode(true)
    stdout.write(terminal.enter)
    stdin.on('keypress', handle)
    stdout.on('resize', render)
    process.on('SIGTERM', quit)
    process.on('SIGHUP', quit)
    process.on('SIGINT', quit)
    process.on('exit', restore)
    stdin.resume()
    void open(() => commits(graphRevision), 'replace')
  })
}
