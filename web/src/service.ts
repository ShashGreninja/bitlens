import type { Params, Results } from '../../shared/types'
import {
  decodeSelection,
  encodeSelection,
  type Selection,
} from '../../shared/investigation'

export type { Selection }
export const isExample = import.meta.env.MODE === 'example'

export async function service<K extends keyof Results>(
  op: K,
  params: Params = {},
): Promise<Results[K]> {
  if (isExample) return (await import('./example')).exampleService(op, params)
  const { invoke } = await import('@forge/bridge')
  const response = await invoke<Results[K]>('history', { op, ...params })
  return 'body' in response ? response.body : response
}

async function pageUrl() {
  if (isExample) return new URL(window.location.href)
  const { view } = await import('@forge/bridge')
  const { extension } = await view.getContext()
  const url = new URL(extension.location)
  if (url.protocol !== 'https:' || url.hostname !== 'bitbucket.org') {
    throw new Error('Open this investigation from its Bitbucket repository.')
  }
  return url
}

export async function readInvestigation(): Promise<Selection | null> {
  const url = await pageUrl()
  if (isExample || url.searchParams.has('investigation'))
    return decodeSelection(url.searchParams)
  const { view } = await import('@forge/bridge')
  const history = await view.createHistory()
  return decodeSelection(new URLSearchParams(history.location.search))
}

export async function shareInvestigation(
  selection: Selection,
): Promise<string> {
  return encodeSelection(await pageUrl(), selection)
}

export async function openSource(raw: string): Promise<void> {
  const url = new URL(raw, window.location.href)
  if (
    isExample &&
    url.origin === window.location.origin &&
    url.hash.startsWith('#evidence=')
  ) {
    window.open(url.href, '_blank', 'noopener,noreferrer')
    return
  }
  if (url.protocol !== 'https:' || url.hostname !== 'bitbucket.org') {
    throw new Error('The requested Bitbucket source link is unavailable.')
  }
  if (isExample) window.open(url.href, '_blank', 'noopener,noreferrer')
  else await (await import('@forge/bridge')).router.open(url.href)
}
