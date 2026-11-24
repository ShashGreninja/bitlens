import { useEffect, useState, type RefObject } from 'react'

export type Point = { x: number; y: number }
const origin = { x: 0, y: 0, scale: 1 }

export function useMapCamera(port: RefObject<HTMLDivElement>) {
  const [camera, setCamera] = useState(origin)
  const panTo = ({ x, y }: Point) =>
    setCamera((previous) => ({ ...previous, x, y }))
  function zoomBy(factor: number, point?: Point) {
    const viewport = port.current
    if (!viewport) return
    const anchor = point ?? {
      x: viewport.clientWidth / 2,
      y: viewport.clientHeight / 2,
    }
    setCamera((previous) => {
      const scale = Math.max(0.1, Math.min(2.5, previous.scale * factor))
      const ratio = scale / previous.scale
      return {
        x: anchor.x + (previous.x - anchor.x) * ratio,
        y: anchor.y + (previous.y - anchor.y) * ratio,
        scale,
      }
    })
  }
  useEffect(() => {
    const viewport = port.current
    if (!viewport) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      const bounds = viewport.getBoundingClientRect()
      const pixels =
        event.deltaMode === 1
          ? event.deltaY * 16
          : event.deltaMode === 2
            ? event.deltaY * viewport.clientHeight
            : event.deltaY
      zoomBy(Math.exp(-pixels * 0.0018), {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })
    }
    viewport.addEventListener('wheel', wheel, { passive: false })
    return () => viewport.removeEventListener('wheel', wheel)
  }, [port])
  function fit(width: number, height: number) {
    const viewport = port.current
    if (!viewport) return
    const scale = Math.max(
      0.1,
      Math.min(
        1.35,
        viewport.clientWidth / width,
        viewport.clientHeight / height,
      ),
    )
    setCamera({
      x: (viewport.clientWidth - width * scale) / 2,
      y: (viewport.clientHeight - height * scale) / 2,
      scale,
    })
  }
  return { camera, panTo, zoomBy, fit, reset: () => setCamera(origin) }
}
