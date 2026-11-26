import api, { route, routeFromAbsolute } from '@forge/api'
import Resolver from '@forge/resolver'
import type { Params, Results } from '../shared/types'
import {
  pushObservation,
  repositoryContext,
  uuid,
  type PushPayload,
} from './domain'
import { authorize, history, type FetchRepo } from './history'
import { RepositoryStorage } from './storage'
import { answerHelp } from './help'
import { workbench, type RequestRepo } from './workbench'

const operations = new Set([
  'bootstrap',
  'compare',
  'detail',
  'graph',
  'replay',
  'tree',
])
function storageFor(workspace: string, repo: string) {
  return new RepositoryStorage('rh:' + workspace + ':' + repo)
}

const resolver = new Resolver()
resolver.define('workbench', async ({ context, payload }) => {
  const { workspace, repo } = repositoryContext(context)
  const repoRoute = route`/2.0/repositories/${context.workspaceId}/${context.extension.repository.uuid}`
  const request: RequestRepo = (suffix, method = 'GET', body) => api.asUser().requestBitbucket(
    suffix ? routeFromAbsolute('https://api.bitbucket.org' + repoRoute.value + suffix) : repoRoute,
    { method, headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) },
  )
  const response = await request('')
  if (!response.ok) throw new Error('You do not have access to this repository.')
  const metadata = await response.json() as { uuid: string; workspace: { uuid: string }; full_name: string }
  if (uuid(metadata.uuid) !== repo || uuid(metadata.workspace.uuid) !== workspace) throw new Error('Repository context mismatch.')
  return workbench(payload, request, repo, `https://bitbucket.org/${metadata.full_name}`)
})
resolver.define('help', async ({ context, payload }) => {
  repositoryContext(context)
  return { answer: await answerHelp(payload?.question, payload?.view, payload?.history) }
})
resolver.define('history', async ({ context, payload }) => {
  const { workspace, repo } = repositoryContext(context)
  if (!payload || !operations.has(payload.op))
    throw new Error('Unknown repository history operation.')
  if (
    payload.cursor !== undefined &&
    (typeof payload.cursor !== 'string' ||
      !/^[a-f0-9]{64}$/.test(payload.cursor))
  ) {
    throw new Error('Invalid continuation.')
  }
  if (payload.deleted !== undefined && typeof payload.deleted !== 'boolean')
    throw new Error('Invalid file selection.')
  const repoRoute = route`/2.0/repositories/${context.workspaceId}/${context.extension.repository.uuid}`
  const fetch: FetchRepo = (suffix, accept) =>
    api
      .asUser()
      .requestBitbucket(
        suffix
          ? routeFromAbsolute(
              'https://api.bitbucket.org' + repoRoute.value + suffix,
            )
          : repoRoute,
        { headers: { Accept: accept } },
      )
  // All operations, including KVS replay and continuation reads, pass this gate.
  const metadata = await authorize(fetch)
  if (
    uuid(metadata.uuid) !== repo ||
    uuid(metadata.workspace.uuid) !== workspace
  )
    throw new Error('Repository context mismatch.')
  return history(
    payload.op as keyof Results,
    payload as Params,
    metadata,
    fetch,
    storageFor(workspace, repo),
  )
})

export const handler = resolver.getDefinitions()

export async function onPush(event: PushPayload) {
  if (event.eventType !== 'avi:bitbucket:push:repository') return
  await storageFor(
    uuid(event.workspace.uuid),
    uuid(event.repository.uuid),
  ).append(pushObservation(event))
}
