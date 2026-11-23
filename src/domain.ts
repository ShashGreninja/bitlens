import { createHash } from 'node:crypto'
import type { Change, Commit, Ref, ReplayEvent } from '../shared/types'

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

export function revision(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > 255 ||
    /[\x00-\x20\x7f~^:?*\[\\]/.test(value) ||
    value.includes('..') ||
    value.includes('@{') ||
    value.split('/').some((s) => !s || s === '.')
  ) {
    throw new Error('Select a valid branch, tag or commit.')
  }
  return value
}

export function filePath(value: unknown, allowRoot = false): string {
  if ((value === '' || value === undefined) && allowRoot) return ''
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > 4096 ||
    /[\x00-\x1f\x7f\\]/.test(value) ||
    value.split('/').some((s) => !s || s === '.' || s === '..')
  )
    throw new Error('Invalid repository path.')
  return value
}

export const encodedPath = (path: string) =>
  path.split('/').map(encodeURIComponent).join('/')
export const isHash = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f\d]{40}$/i.test(value)
export function fullHash(value: unknown) {
  if (!isHash(value))
    throw new Error('Bitbucket did not return a full commit hash.')
  return value.toLowerCase()
}

// Bitbucket takes the changed revision first, unlike git diff.
export const compareSpec = (base: string, target: string) =>
  fullHash(target) + '..' + fullHash(base)

export type ApiCommit = {
  hash: string
  parents?: { hash: string }[]
  message?: string
  date?: string
  author?: { user?: { display_name?: string }; raw?: string }
}
export type ApiChange = {
  status: string
  old: { path: string } | null
  new: { path: string } | null
  lines_added: number
  lines_removed: number
}
export function change(value: ApiChange): Change {
  return {
    status: value.status,
    oldPath: value.old?.path ?? null,
    newPath: value.new?.path ?? null,
    added: value.lines_added,
    removed: value.lines_removed,
  }
}
export function commit(value: ApiCommit, webUrl: string): Commit {
  const hash = fullHash(value.hash)
  return {
    hash,
    parents: (value.parents ?? []).map((p) => fullHash(p.hash)),
    message: value.message?.trim().slice(0, 4096) ?? '',
    author:
      value.author?.user?.display_name || value.author?.raw || 'Unknown author',
    date: value.date ?? '',
    url: webUrl + '/commits/' + hash,
  }
}

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
