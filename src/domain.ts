import { createHash } from 'node:crypto'
import type { Ref, ReplayEvent } from '../shared/types'

export const digest = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex')
const uuidPattern = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i
export function uuid(value: unknown): string {
  const id = typeof value === 'string' ? value.replace(/^\{(.+)\}$/, '$1') : ''
  if (!uuidPattern.test(id))
    throw new Error('A valid Bitbucket repository context is required.')
  return id.toLowerCase()
}

export function repositoryContext(context: {
  accountId?: unknown
  workspaceId?: unknown
  extension?: { repository?: { uuid?: unknown } }
}) {
  if (!context.accountId)
    throw new Error('Sign in to Bitbucket to access repository history.')
  return {
    workspace: uuid(context.workspaceId),
    repo: uuid(context.extension?.repository?.uuid),
  }
}

export * from './gitRecords'
import { revision, isHash } from './gitRecords'
export type Recorded = ReplayEvent & { refType: Ref['kind'] }
export type PushPayload = {
  eventType: string
  timestamp: string
  workspace: { uuid: string }
  repository: { uuid: string }
  actor?: { displayName?: string; accountId?: string; uuid?: string }
  push: {
    ref: string
    mainbranch?: boolean
    commits?: unknown[]
    created: boolean
    closed: boolean
    forced: boolean
    before?: string
    after?: string
  }
}
export function pushObservation(event: PushPayload): Recorded {
  const push = event.push
  const refType =
    typeof push.mainbranch === 'boolean' || Array.isArray(push.commits)
      ? 'branch'
      : 'tag'
  const ref = revision(push.ref)
  const before =
    !push.created && isHash(push.before) ? push.before.toLowerCase() : null
  const after =
    !push.closed && isHash(push.after) ? push.after.toLowerCase() : null
  const kind = push.closed
    ? 'delete'
    : refType === 'tag'
      ? 'tag'
      : push.created
        ? 'create'
        : push.forced
          ? 'force-push'
          : 'push'
  const date = new Date(event.timestamp).toISOString()
  const actor =
    event.actor?.displayName ||
    event.actor?.accountId ||
    event.actor?.uuid ||
    'Unknown actor'
  const id = digest([refType, ref, event.timestamp, kind, before, after, actor])
  return {
    id,
    ref,
    refType,
    kind,
    date,
    actor,
    before,
    after,
    gap: (!before && !push.created) || (!after && !push.closed),
  }
}

export const refKey = (type: Ref['kind'], ref: string) => type + '/' + ref
export function trackEvent(
  event: Recorded,
  pointers: Map<string, string | null>,
): Recorded {
  const key = refKey(event.refType, event.ref)
  const continuityGap =
    pointers.has(key) &&
    (event.kind === 'snapshot'
      ? pointers.get(key) !== event.after
      : pointers.get(key) !== event.before)
  pointers.set(key, event.after)
  return { ...event, gap: Boolean(event.gap || continuityGap) }
}
