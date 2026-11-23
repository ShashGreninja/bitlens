import { useCallback, useEffect, useRef, useState } from 'react'
import type { Params, Results } from '../../../shared/types'
import { service } from '../service'

export const short = (hash: string | null | undefined) =>
  hash?.slice(0, 7) || '—'
export const basename = (path: string) => path.split('/').at(-1) || path
export const dirname = (path: string) =>
  path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
export const pathOf = (change: Results['compare']['changes'][number]) =>
  change.newPath || change.oldPath || ''
export const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error)
export function dateText(date: string, time = false) {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return date || 'Unknown date'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(time
      ? ({ hour: 'numeric', minute: '2-digit', timeZoneName: 'short' } as const)
      : {}),
  }).format(d)
}

type PagedOp = Exclude<keyof Results, 'bootstrap'>
type PageState<K extends PagedOp> = {
  key: string
  data?: Results[K]
  error?: string
  busy: boolean
}
function appendPage<K extends PagedOp>(
  op: K,
  first: Results[K],
  page: Results[K],
): Results[K] {
  const field = {
    compare: 'changes',
    detail: 'history',
    graph: 'commits',
    replay: 'events',
    tree: 'entries',
  }[op]
  const a = first as unknown as Record<string, unknown[]>
  const b = page as unknown as Record<string, unknown[]>
  return {
    ...first,
    ...page,
    ...(op === 'detail' ? { diff: (first as Results['detail']).diff } : {}),
    [field]: [...a[field], ...b[field]],
  }
}
export function usePages<K extends PagedOp>(
  op: K,
  params: Params,
  enabled: boolean,
) {
  const key = JSON.stringify(params)
  const serial = useRef(0)
  const paging = useRef(false)
  const [retryCount, setRetryCount] = useState(0)
  const [state, setState] = useState<PageState<K>>({ key: '', busy: false })
  useEffect(() => {
    const id = ++serial.current
    paging.current = false
    if (!enabled) {
      setState({ key, busy: false })
      return
    }
    setState({ key, busy: true })
    service(op, JSON.parse(key)).then(
      (data) => {
        if (serial.current === id) setState({ key, data, busy: false })
      },
      (err) => {
        if (serial.current === id)
          setState({ key, error: messageOf(err), busy: false })
      },
    )
    return () => {
      serial.current++
    }
  }, [op, key, enabled, retryCount])
  const active =
    enabled && state.key === key
      ? state
      : ({ key, busy: enabled } as PageState<K>)
  const next = useCallback(async () => {
    if (!enabled || paging.current || !state.data?.next || state.key !== key)
      return
    paging.current = true
    const id = serial.current
    const data = state.data
    setState({ key, data, busy: true })
    try {
      const page = await service(op, { ...JSON.parse(key), cursor: data.next })
      if (serial.current === id)
        setState({ key, data: appendPage(op, data, page), busy: false })
    } catch (err) {
      if (serial.current === id)
        setState({ key, data, busy: false, error: messageOf(err) })
    } finally {
      if (serial.current === id) paging.current = false
    }
  }, [enabled, state.data, state.key, key, op])
  return { ...active, next, retry: () => setRetryCount((x) => x + 1) }
}
export type Page<K extends PagedOp> = ReturnType<typeof usePages<K>>

// Reopen records beyond the first page. Keep automatic reads bounded when a
// shared record is missing. The normal "Load more" action remains available.
export function useLocateRecord<K extends PagedOp>(
  page: Page<K>,
  missing?: string,
) {
  const search = useRef({ key: '', pages: 0 })
  const { data, busy, error, next } = page
  useEffect(() => {
    const key = JSON.stringify([page.key, missing])
    if (search.current.key !== key) search.current = { key, pages: 0 }
    if (!missing || !data?.next || busy || error || search.current.pages >= 8)
      return
    search.current.pages++
    void next()
  }, [missing, page.key, data?.next, busy, error, next])
}
