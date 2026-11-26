import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { authorize, history, type FetchRepo } from '../src/history'
import { repositoryName } from '../shared/repositoryName'
import type { Params, Results, Service } from '../shared/types'

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

export async function openTerminalRepository(
  name?: string,
  options: { paginate?: boolean; signal?: AbortSignal } = {},
) {
  const repository = repositoryName(name || origin())
  const token = process.env.BITBUCKET_TOKEN
  const request: FetchRepo = (suffix, accept) => {
    const timeout = AbortSignal.timeout(15_000)
    return fetch('https://api.bitbucket.org/2.0/repositories/' + repository + suffix, {
      redirect: 'error',
      signal: options.signal ? AbortSignal.any([timeout, options.signal]) : timeout,
      headers: { Accept: accept, ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    })
  }
  const metadata = await authorize(request)
  const cursors = new Map<string, { scope: string; value: unknown }>()
  const storage = {
    async initialize() {},
    async saveCursor<T>(scope: string, value: T) {
      if (!options.paginate) return 'more'
      const key = randomBytes(32).toString('hex')
      cursors.set(key, { scope, value })
      return key
    },
    async loadCursor<T>(scope: string, key: unknown) {
      const cursor = typeof key === 'string' ? cursors.get(key) : undefined
      if (!cursor || cursor.scope !== scope) throw new Error('This page could not be resumed.')
      return cursor.value as T
    },
    async replay() { throw new Error('Open Replay in the installed Bitbucket app.') },
  }
  const service: Service = <K extends keyof Results>(operation: K, params: Params = {}) =>
    history(operation, params, metadata, request, storage) as Promise<Results[K]>
  return { service, defaultBranch: metadata.mainbranch?.name }
}
