import { useEffect, useRef, type ReactNode } from 'react'
import {
  AlertCircle,
  ArrowDown,
  ArrowUpRight,
  Check,
  Copy,
  FileDiff,
  LoaderCircle,
  X,
} from 'lucide-react'
import { openSource } from '../service'
import { useState } from 'react'
import { messageOf } from './data'

export function Loading({ text = 'Loading records…' }: { text?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle size={17} className="spin" />
      {text}
    </div>
  )
}
export function Problem({ text, retry }: { text: string; retry?: () => void }) {
  return (
    <div className="notice problem" role="alert">
      <AlertCircle size={16} />
      <span>{text}</span>
      {retry && (
        <button className="text-button" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  )
}
export function Empty({ title, text }: { title: string; text?: string }) {
  return (
    <div className="empty">
      <FileDiff size={22} />
      <strong>{title}</strong>
      {text && <p>{text}</p>}
    </div>
  )
}
export function More({
  hasNext,
  busy,
  action,
  label = 'Load more',
}: {
  hasNext?: string
  busy: boolean
  action: () => void
  label?: string
}) {
  return hasNext ? (
    <button className="more" disabled={busy} onClick={action}>
      {busy ? (
        <LoaderCircle size={14} className="spin" />
      ) : (
        <ArrowDown size={14} />
      )}
      {label}
    </button>
  ) : null
}
export function Source({
  url,
  children = 'Open source',
  className = 'source-link',
}: {
  url: string
  children?: ReactNode
  className?: string
}) {
  const [error, setError] = useState('')
  return (
    <>
      <a
        className={className}
        href={url}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
          e.preventDefault()
          setError('')
          openSource(url).catch((err) => setError(messageOf(err)))
        }}
      >
        {children}
        <ArrowUpRight size={13} aria-hidden />
      </a>
      {error && <Problem text={error} />}
    </>
  )
}
export function Dialog({
  title,
  children,
  close,
  variant = 'modal',
}: {
  title: string
  children: ReactNode
  close: () => void
  variant?: 'modal' | 'drawer'
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    el?.showModal()
    return () => el?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className={variant === 'drawer' ? 'bitlens-dialog bitlens-drawer' : 'bitlens-dialog'}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClick={(e) => {
        if (e.target === ref.current) close()
      }}
      aria-label={title}
    >
      <div className="dialog-card">
        <div className="section-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [status, setStatus] = useState('')
  useEffect(() => setStatus(''), [value])
  const copy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext)
        await navigator.clipboard.writeText(value)
      else {
        const el = document.createElement('textarea')
        el.value = value
        const parent = document.querySelector('dialog[open]') || document.body
        parent.appendChild(el)
        el.select()
        const ok = document.execCommand('copy')
        el.remove()
        if (!ok) throw new Error('Select the text and copy it manually.')
      }
      setStatus('Copied')
    } catch {
      setStatus('Select the text and copy it manually.')
    }
  }
  return (
    <div className="copy-action">
      <button className="button" disabled={!value} onClick={copy}>
        {status === 'Copied' ? <Check size={15} /> : <Copy size={15} />}
        {status === 'Copied' ? 'Copied' : label}
      </button>
      <span role="status">{status !== 'Copied' && status}</span>
    </div>
  )
}
