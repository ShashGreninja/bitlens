import snapshot from '../../sample/bitbucket-public.json'
import { history, type Repository } from '../../src/history'
import type { Commit, Params, Ref, Results } from '../../shared/types'

export const source =
  'https://api.bitbucket.org/2.0/repositories/' + snapshot.repo
export const archive = new Map<string, Commit>(
  snapshot.commits.map((c) => [c.hash, c]),
)
const [workspace, repo] = snapshot.repo.split('/')
const refs = snapshot.refs as Ref[]
export const publicRepository = {
  workspace,
  repo,
  refs,
  defaultBranch: snapshot.main,
  webUrl: 'https://bitbucket.org/' + snapshot.repo,
  partial: true,
}
const pages = new Map<string, { scope: string; data: unknown }>()
const storage = {
  async initialize() {},
  async saveCursor<T>(scope: string, data: T) {
    const token = crypto.randomUUID()
    pages.set(token, { scope, data })
    return token
  },
  async loadCursor<T>(scope: string, token: unknown) {
    const entry = pages.get(String(token))
    if (!entry || entry.scope !== scope)
      throw Error('Refresh to restart this query.')
    return entry.data as T
  },
  async replay(): Promise<Results['replay']> {
    return {
      since: null,
      events: [],
      warning:
        'Recording begins when Repository History is installed in a Bitbucket workspace.',
    }
  },
}
let metadata: Repository | undefined
export async function publicHistory<K extends keyof Results>(
  op: K,
  params: Params,
): Promise<Results[K]> {
  if (op === 'bootstrap') return publicRepository as Results[K]
  if (op === 'replay') return (await storage.replay()) as Results[K]
  const request = (suffix: string, accept: string) =>
    fetch(source + suffix, { headers: { Accept: accept } })
  if (!metadata) {
    const response = await request('', 'application/json')
    if (!response.ok) throw Error('Bitbucket could not load this repository.')
    metadata = (await response.json()) as Repository
  }
  const resolve = (name: string | undefined) =>
    refs.find((r) => r.name === name)?.hash || name
  return (await history(
    op,
    { ...params, base: resolve(params.base), target: resolve(params.target) },
    metadata,
    request,
    storage,
  )) as Results[K]
}
export const captured = snapshot.captured.slice(0, 10)
