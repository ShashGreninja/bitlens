import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import './dock.css'

type Layout = { split: number; height?: number; swapped: boolean }
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))

export function Dock({ className, label, split, children, single = false }: {
  className: string
  label: string
  split: number
  children: ReactNode
  single?: boolean
}) {
  const key = 'bitlens-layout:' + label
  const defaults = { split, swapped: false }
  const [layout, setLayout] = useState<Layout>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null')
      if (saved && Number.isFinite(saved.split) && typeof saved.swapped === 'boolean')
        return {
          split: clamp(saved.split, 26, 74),
          swapped: saved.swapped,
          height: Number.isFinite(saved.height) ? clamp(saved.height, 240, 1000) : undefined,
        }
    } catch { /* Browser storage can be unavailable in an embed. */ }
    return defaults
  })
  const frame = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointer: number; x: number; y: number; width: number; height: number; split: number } | null>(null)
  const latest = useRef(layout)
  const swapStart = useRef<number | null>(null)
  const swap = () => update({ ...layout, split: clamp(100 - layout.split, 26, 74), swapped: !layout.swapped })
  function update(next: Layout, save = true) {
    latest.current = next
    setLayout(next)
    if (save) {
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* Layout still works this session. */ }
    }
  }
  function start(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !frame.current) return
    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    const bounds = frame.current.getBoundingClientRect()
    drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, width: bounds.width, height: bounds.height, split: layout.split }
  }
  function move(event: PointerEvent<HTMLDivElement>, corner: boolean) {
    const origin = drag.current
    if (!origin || origin.pointer !== event.pointerId || !origin.width) return
    update({
      ...latest.current,
      split: clamp(origin.split + 100 * (event.clientX - origin.x) / origin.width, 26, 74),
      height: corner ? clamp(origin.height + event.clientY - origin.y, 240, 1000) : latest.current.height,
    }, false)
  }
  function finish(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointer !== event.pointerId) return
    drag.current = null
    update(latest.current)
  }

  return (
    <div ref={frame} className={className + ' dock' + (layout.swapped ? ' dock-swapped' : '')}
      data-single={single || undefined} data-height={Boolean(layout.height) || undefined}
      style={{ '--dock-split': layout.split + '%', '--dock-height': layout.height ? layout.height + 'px' : undefined } as CSSProperties}>
      {children}
      {!single && <>
        <div className="dock-controls">
          <button type="button" className="dock-swap" title="Click or drag to swap panes"
            aria-label={`Swap ${label} panes`}
            onPointerDown={(event) => {
              if (event.button !== 0) return
              swapStart.current = event.clientX
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerUp={(event) => {
              if (swapStart.current !== null) swap()
              swapStart.current = null
            }}
            onPointerCancel={() => { swapStart.current = null }}
            onClick={(event) => { if (event.detail === 0) swap() }}>
            <ArrowLeftRight size={12} aria-hidden="true" />
          </button>
          <div className="dock-divider" role="separator" aria-label={`Resize ${label} panes`}
            aria-orientation="vertical" aria-valuemin={26} aria-valuemax={74} aria-valuenow={Math.round(layout.split)}
            tabIndex={0} onPointerDown={start} onPointerMove={(event) => move(event, false)}
            onLostPointerCapture={finish} onDoubleClick={() => update(defaults)}
            onKeyDown={(event) => {
              if (event.key === 'Home') update(defaults)
              else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
                update({ ...layout, split: clamp(layout.split + (event.key === 'ArrowLeft' ? -3 : 3), 26, 74) })
              else return
              event.preventDefault()
            }} />
        </div>
        <div className="dock-corner" role="separator" tabIndex={0}
          aria-label={`Resize ${label} workspace height`} aria-orientation="horizontal"
          onPointerDown={start} onPointerMove={(event) => move(event, true)} onLostPointerCapture={finish}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
            event.preventDefault()
            update({ ...layout, height: clamp((frame.current?.offsetHeight || 420) + (event.key === 'ArrowUp' ? -24 : 24), 240, 1000) })
          }} />
      </>}
    </div>
  )
}
