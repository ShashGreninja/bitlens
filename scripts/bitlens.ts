#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import { authorize, history, type FetchRepo } from '../src/history'
import { repositoryName } from '../shared/repositoryName'
import type { Params, Results } from '../shared/types'

const help = `Usage: npm run bitlens -- <command> [arguments] [--repo workspace/repository] [--json]

  refs                  List branches and tags
  graph [REV]           Show recent commits and their parents
  compare BASE TARGET   List changed files
  file BASE TARGET PATH Show the patch and rename history for a file
  tree [REV] [PATH]     List files at a revision

Repository defaults to the Bitbucket origin of the current Git checkout.
Set BITBUCKET_TOKEN for bearer authentication. Output contains the first page.
Replay is available in the installed Bitbucket app.`

function origin() {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: process.env.INIT_CWD || process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return url.replace(/^git@bitbucket\.org:/, '').replace(/^ssh:\/\/git@bitbucket\.org\//, '')
  } catch {
    throw new Error('Pass --repo or run in a checkout with a Bitbucket origin.')
  }
}

function print(...parts: unknown[]) {
  const text = parts.filter((part) => part != null).join(' ')
  console.log(text.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, ''))
}

async function run() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { repo: { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } },
  })
  const [command, ...args] = positionals
  if (values.help || !command) {
    console.log(help)
    return
  }
  const specs = {
    refs: [0, 0, 'bootstrap'],
    graph: [0, 1, 'graph'],
    compare: [2, 2, 'compare'],
    file: [3, 3, 'detail'],
    tree: [0, 2, 'tree'],
  } as const
  if (!Object.hasOwn(specs, command)) throw new Error(`Unknown command: ${command}. See --help.`)
  const [min, max, operation] = specs[command as keyof typeof specs]
  if (args.length < min || args.length > max) throw new Error(`Wrong number of arguments for ${command}. See --help.`)
  const repository = repositoryName(values.repo || origin())
  const token = process.env.BITBUCKET_TOKEN
  const request: FetchRepo = (suffix, accept) => fetch(
    'https://api.bitbucket.org/2.0/repositories/' + repository + suffix,
    {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: { Accept: accept, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    },
  )
  const metadata = await authorize(request)
  const revision = args[0] || metadata.mainbranch?.name
  const params: Params = operation === 'tree'
    ? { target: revision, path: args[1] || '' }
    : operation === 'graph'
      ? { base: revision, target: revision }
      : { base: args[0], target: args[1], path: args[2] }
  const result = await history(operation, params, metadata, request, {
    async initialize() {},
    async saveCursor() { return 'more' },
    async loadCursor() { throw new Error('Pagination is unavailable in the CLI.') },
    async replay() { throw new Error('Open Replay in Bitbucket.') },
  })
  if (values.json) {
    console.log(JSON.stringify(result, null, 2).replace(/[\u007f-\u009f]/g, (char) => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')))
    return
  }
  const data = result as Partial<Results['bootstrap'] & Results['graph'] & Results['compare'] & Results['detail'] & Results['tree']>
  if (data.refs) for (const ref of data.refs) print(ref.kind, ref.hash.slice(0, 8), ref.name)
  if (data.commits) for (const commit of data.commits) {
    const parents = commit.parents.map((hash) => hash.slice(0, 8))
    print(commit.hash.slice(0, 8), commit.message.split('\n')[0], parents.length ? `← ${parents.join(', ')}` : '')
  }
  if (data.changes) for (const file of data.changes) print(file.status, `+${file.added} -${file.removed}`, file.oldPath && file.newPath && file.oldPath !== file.newPath ? `${file.oldPath} → ${file.newPath}` : file.newPath || file.oldPath)
  if (data.diff) print(data.diff.trimEnd())
  if (data.history) for (const item of data.history) print(item.hash.slice(0, 8), item.path, item.message.split('\n')[0])
  if (data.entries) for (const item of data.entries) print(item.path + (item.directory ? '/' : ''))
  if (data.warning) console.error(data.warning)
  if (data.next || data.partial) console.error('Showing the first page.')
}

run().catch((error: unknown) => {
  console.error('bitlens:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
