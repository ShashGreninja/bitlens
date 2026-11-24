export interface Selection {
  base: string
  target: string
  path?: string
  previousPath?: string
  fileSide?: string
  commit?: string
  event?: string
  lineage?: string
  view?: string
}

const fullHash = /^[0-9a-f]{40}$/i

export function encodeSelection(url: URL, selection: Selection): string {
  if (!fullHash.test(selection.base) || !fullHash.test(selection.target)) {
    throw new Error('Resolve both revisions before sharing.')
  }
  const result = new URL(url)
  result.searchParams.set('investigation', '1')
  for (const key of [
    'base',
    'target',
    'path',
    'previousPath',
    'fileSide',
    'commit',
    'event',
    'view',
    'lineage',
  ] as const) {
    const value = selection[key]
    if (value) result.searchParams.set(key, value)
    else result.searchParams.delete(key)
  }
  return result.toString()
}

export function decodeSelection(params: URLSearchParams): Selection | null {
  if (!params.has('investigation')) return null
  const base = params.get('base') || ''
  const target = params.get('target') || ''
  if (
    params.get('investigation') !== '1' ||
    !fullHash.test(base) ||
    !fullHash.test(target)
  ) {
    throw new Error(
      'This shared investigation has incomplete or unsupported revision information.',
    )
  }
  const result: Selection = { base, target }
  for (const key of [
    'path',
    'previousPath',
    'fileSide',
    'commit',
    'event',
    'view',
    'lineage',
  ] as const) {
    const value = params.get(key)
    if (
      value &&
      value.length > (key === 'path' || key === 'previousPath' ? 4096 : 255)
    ) {
      throw new Error(
        'This shared investigation contains an invalid ' + key + '.',
      )
    }
    if (value) result[key] = value
  }
  return result
}
