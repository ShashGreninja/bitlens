import snapshot from '../../sample/bitbucket-public.json'
import {
  authorize,
  BitbucketError,
  history,
  type FetchRepo,
  type Repository,
} from '../../src/history'
import type { Commit, Params, Ref, Results } from '../../shared/types'

export const archive = new Map<string, Commit>(
  snapshot.commits.map((c) => [c.hash, c]),
)
const [workspace, repo] = snapshot.repo.split('/')
const refs = snapshot.refs as Ref[]
const publicRepository = {
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
        'The public preview reads commits from Bitbucket. Live event recording runs in the installed Forge app.',
    }
  },
}
function requestsFor(name: string): FetchRepo {
  const route = name.split('/').map(encodeURIComponent).join('/')
  return (suffix, accept) =>
    fetch('https://api.bitbucket.org/2.0/repositories/' + route + suffix, {
      headers: { Accept: accept },
      credentials: 'omit',
    })
}

export async function checkPublicRepository(name: string) {
  try {
    await authorize(requestsFor(name))
  } catch (error) {
    if (error instanceof BitbucketError && [401, 403, 404].includes(error.status))
      throw new Error('This repository is private or could not be found. Check the URL or open it from bitlens in Bitbucket.')
    throw error
  }
}

let cached: { name: string; data: Promise<Repository> } | undefined
export async function publicHistory<K extends keyof Results>(
  op: K,
  params: Params,
  name = snapshot.repo,
): Promise<Results[K]> {
  const demo = name === snapshot.repo
  if (op === 'bootstrap' && demo) return publicRepository as Results[K]
  if (op === 'replay') return (await storage.replay()) as Results[K]
  const request = requestsFor(name)
  if (cached?.name !== name) {
    const data = authorize(request).catch((error) => {
      if (cached?.data === data) cached = undefined
      throw error
    })
    cached = { name, data }
  }
  const metadata = await cached.data
  const resolve = (name: string | undefined) =>
    (demo ? refs.find((r) => r.name === name)?.hash : undefined) || name
  return (await history(
    op,
    { ...params, base: resolve(params.base), target: resolve(params.target) },
    metadata,
    request,
    storage,
  )) as Results[K]
}
export const captured = snapshot.captured.slice(0, 10)
export const snapshotRepository = snapshot.repo
