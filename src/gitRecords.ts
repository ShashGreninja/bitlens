import type { Change, Commit } from '../shared/types'
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
