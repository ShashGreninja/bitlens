import { lazy, Suspense, useMemo, useState } from 'react'
import type { Ref, ReplayEvent } from '../../../shared/types'
import { Loading } from './Common'
import { usePages } from './data'

const Graph = lazy(() => import('./Graph'))

export function ReplayGraph({
  events,
  index,
}: {
  events: ReplayEvent[]
  index: number
}) {
  const [side, setSide] = useState<'before' | 'after'>('after')
  const [selected, setSelected] = useState<string>()
  const event = events[index]
  const pointer = event[side] ? side : side === 'after' ? 'before' : 'after'
  const tip = event[pointer] || ''
  const refs = useMemo(() => {
    const observed = new Map<string, Ref>()
    for (const record of events.slice(0, index + 1)) {
      const hash = record.id === event.id ? record[pointer] : record.after
      const key = record.refType + '/' + record.ref
      if (hash)
        observed.set(key, { name: record.ref, kind: record.refType, hash })
      else observed.delete(key)
    }
    return [...observed.values()]
  }, [events, index, event, pointer])
  const graph = usePages('graph', { base: tip, target: tip }, Boolean(tip))
  return (
    <section className="replay-graph">
      <div className="section-heading">
        <h3>{event.ref} ancestry</h3>
        <div className="segmented" aria-label="Pointer to inspect">
          {(['before', 'after'] as const).map((value) => (
            <button
              key={value}
              disabled={!event[value]}
              aria-pressed={pointer === value}
              className={pointer === value ? 'active' : ''}
              onClick={() => {
                setSide(value)
                setSelected(undefined)
              }}
            >
              {value === 'before' ? 'Before event' : 'After event'}
            </button>
          ))}
        </div>
      </div>
      <Suspense fallback={<Loading text="Loading commit graph…" />}>
        <Graph
          page={graph}
          base={tip}
          target={tip}
          selected={selected || tip}
          select={setSelected}
          refs={refs}
        />
      </Suspense>
    </section>
  )
}
