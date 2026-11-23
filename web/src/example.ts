import records from '../../sample/history.json'
import type {
  Change,
  Commit,
  Params,
  Ref,
  ReplayEvent,
  Results,
  Service,
} from '../../shared/types'

type Patch = { change: Change; diff: string }
type ExamplePR = { id: number; title: string; strategy: string; source: string }
type Evidence = {
  commits: Record<string, Omit<Commit, 'url'>>
  trees: Record<string, Record<string, string>>
  history: Record<string, Record<string, string[][]>>
  patches: Patch[]
  comparisons: Record<string, Record<string, number[]>>
  refs: Ref[]
  events: ReplayEvent[]
  prs: Record<string, ExamplePR>
}
export const exampleData = records as Evidence

export function evidenceUrl(
  kind: 'repository' | 'commit' | 'pr' | 'source',
  hash = '',
  path = '',
) {
  const query = new URLSearchParams({ evidence: kind })
  if (hash) query.set('hash', hash)
  if (path) query.set('path', path)
  return '#' + query.toString()
}

function resolve(name: string) {
  const ref = exampleData.refs.find((ref) => ref.name === name)
  if (ref) return ref.hash
  const prefix = name.toLowerCase()
  if (/^[0-9a-f]{7,40}$/.test(prefix)) {
    const hits = Object.keys(exampleData.commits).filter((hash) =>
      hash.startsWith(prefix),
    )
    if (hits.length === 1) return hits[0]
  }
  throw new Error(
    `Revision “${name}” is unavailable in this example repository.`,
  )
}

function patches(base: string, target: string) {
  return exampleData.comparisons[base][target].map(
    (index) => exampleData.patches[index],
  )
}

function ancestors(...pending: string[]) {
  const seen = new Set<string>()
  while (pending.length) {
    const hash = pending.pop()!
    if (seen.has(hash)) continue
    seen.add(hash)
    pending.push(...exampleData.commits[hash].parents)
  }
  return seen
}

function detail(
  base: string,
  target: string,
  params: Params,
): Results['detail'] {
  const path = params.path || params.oldPath
  if (!path) throw new Error('Choose a file to inspect its history.')
  const patch = patches(base, target).find(
    ({ change }) => (change.newPath ?? change.oldPath) === path,
  )
  const rev =
    params.deleted || patch?.change.status === 'removed' ? base : target
  const lineage = Object.hasOwn(exampleData.history[rev], path)
    ? exampleData.history[rev][path]
    : undefined
  if (!lineage)
    throw new Error('This path is unavailable at the selected revision.')
  const reachable = ancestors(rev)
  const landed = Object.entries(exampleData.prs).filter(([hash]) =>
    reachable.has(hash),
  )
  const history = lineage.map(([hash, historicalPath]) => {
    const { author, date, message } = exampleData.commits[hash]
    const evidence = landed.find(
      ([landing, pr]) => landing === hash || pr.source === hash,
    )
    return {
      hash,
      path: historicalPath,
      author,
      date,
      message,
      url: evidenceUrl('commit', hash),
      ...(evidence && {
        pr: {
          id: evidence[1].id,
          title: evidence[1].title,
          url: evidenceUrl('pr', evidence[0]),
        },
      }),
    }
  })
  return { diff: patch?.diff ?? '', history }
}

function graph(base: string, target: string): Results['graph'] {
  const seen = ancestors(base, target)
  // The fixture clock increases at every commit, including both sides of a merge.
  const commits = [...seen].map((hash) => ({
    ...exampleData.commits[hash],
    url: evidenceUrl('commit', hash),
  }))
  return { commits: commits.sort((a, b) => b.date.localeCompare(a.date)) }
}

function tree(target: string, directory = ''): Results['tree'] {
  const prefix = directory ? directory + '/' : ''
  const entries = new Map<string, Results['tree']['entries'][number]>()
  for (const file of Object.keys(exampleData.trees[target])) {
    if (!file.startsWith(prefix)) continue
    const path = prefix + file.slice(prefix.length).split('/')[0]
    entries.set(path, {
      path,
      directory: path !== file,
      url: evidenceUrl('source', target, path),
    })
  }
  if (directory && !entries.size)
    throw new Error('This directory is unavailable at the selected revision.')
  return {
    entries: [...entries.values()].sort(
      (a, b) =>
        Number(b.directory) - Number(a.directory) ||
        a.path.localeCompare(b.path),
    ),
  }
}

async function dispatch(
  op: keyof Results,
  params: Params,
): Promise<Results[keyof Results]> {
  if (params.cursor) throw new Error('This example has no additional pages.')
  if (op === 'bootstrap') {
    return {
      repo: 'payments-service',
      workspace: 'Northstar Engineering',
      defaultBranch: 'main',
      refs: exampleData.refs,
      webUrl: evidenceUrl('repository'),
    }
  }
  if (op === 'replay')
    return { since: exampleData.events[0].date, events: exampleData.events }
  const target = resolve(params.target ?? 'main')
  if (op === 'tree') return tree(target, params.path)
  const base = resolve(params.base ?? 'v1.4')
  if (op === 'compare')
    return {
      base,
      target,
      changes: patches(base, target).map((patch) => patch.change),
    }
  if (op === 'graph') return graph(base, target)
  if (op === 'detail') return detail(base, target, params)
  throw new Error('Unknown example operation.')
}

export const exampleService: Service = <K extends keyof Results>(
  op: K,
  params: Params = {},
) => dispatch(op, params) as Promise<Results[K]>
