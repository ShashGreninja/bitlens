import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  CircleDot,
  GitBranch,
  GitCommitHorizontal,
  Search,
  Tag,
} from 'lucide-react'
import type { Ref } from '../../../shared/types'
import { short } from './data'

type Props = {
  refs: Ref[]
  base: string
  target: string
  hashes?: { base: string; target: string }
  setPair: (base: string, target: string) => void
  partial?: boolean
}
export function Revisions({ refs, base, target, hashes, setPair, partial }: Props) {
  const [open, setOpen] = useState<'base' | 'target' | null>(null)
  const [search, setSearch] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const filter = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!open) return
    filter.current?.focus()
    const dismiss = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(null)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(null)
        opener.current?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  function picker(side: 'base' | 'target') {
    const value = side === 'base' ? base : target
    const ref =
      refs.find((r) => r.name === value) ||
      refs.find((r) => r.hash === value && r.kind === 'tag') ||
      refs.find((r) => r.hash === value)
    const hash =
      hashes?.[side] ||
      ref?.hash ||
      (/^[0-9a-f]{7,40}$/i.test(value) ? value : '')
    const title = side === 'base' ? 'Baseline' : 'Target'
    const choose = (v: string) => {
      if (side === 'base') setPair(v, target)
      else setPair(base, v)
      setOpen(null)
      opener.current?.focus()
    }
    const query = search.trim()
    const matches = refs.filter((r) =>
      (r.name + ' ' + r.hash).toLowerCase().includes(query.toLowerCase()),
    )
    return (
      <div className={'revision ' + side}>
        <span className="revision-label">
          <span className="point" />
          {title}
        </span>
        <button
          className="revision-trigger"
          aria-label={`Select ${title.toLowerCase()} revision, ${value || 'unselected'}`}
          aria-expanded={open === side}
          aria-haspopup="dialog"
          onClick={(e) => {
            opener.current = e.currentTarget
            setSearch('')
            setOpen(open === side ? null : side)
          }}
        >
          {ref?.kind === 'tag' ? (
            <Tag size={17} />
          ) : ref?.kind === 'branch' ? (
            <GitBranch size={17} />
          ) : (
            <GitCommitHorizontal size={17} />
          )}
          <strong>
            {ref?.name ||
              (/^[0-9a-f]{12,40}$/i.test(value) ? short(value) : value) ||
              'Choose a revision'}
          </strong>
          <ChevronDown size={15} />
          <code className="revision-hash">{short(hash)}</code>
        </button>
        {open === side && (
          <div
            className="picker"
            role="dialog"
            aria-label={title + ' revision'}
          >
            <form
              className="picker-search"
              onSubmit={(e) => {
                e.preventDefault()
                if (query) choose(query)
              }}
            >
              <Search size={16} />
              <input
                ref={filter}
                aria-label="Find a revision or enter a commit hash"
                placeholder="Find ref or enter commit hash"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </form>
            <div className="picker-options">
              {partial && !query && refs.length > 0 && (
                <p>Missing a branch or tag? Enter its name or a commit hash.</p>
              )}
              {matches.map((r) => (
                <button key={r.kind + r.name} onClick={() => choose(r.name)}>
                  {r.kind === 'tag' ? (
                    <Tag size={14} />
                  ) : (
                    <GitBranch size={14} />
                  )}
                  <span>{r.name}</span>
                  <code>{short(r.hash)}</code>
                  {r.name === ref?.name && <Check size={14} />}
                </button>
              ))}
              {query && !matches.some((r) => r.name === query) && (
                <button onClick={() => choose(query)}>
                  <CircleDot size={14} />
                  <span>Use “{query}”</span>
                </button>
              )}
              {!query && !matches.length && (
                <p>Enter a branch, tag, or commit hash.</p>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }
  return (
    <div className="revisions" ref={box}>
      {picker('base')}
      <button
        className="swap"
        onClick={() => {
          setPair(target, base)
          setOpen(null)
        }}
        title="Swap baseline and target"
        aria-label="Swap baseline and target"
      >
        <ArrowLeftRight size={15} />
      </button>
      {picker('target')}
    </div>
  )
}
