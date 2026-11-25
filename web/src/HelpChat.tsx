import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowUp, CircleHelp } from 'lucide-react'
import { helpTopics, type helpViews } from '../../shared/help'
import { Dialog } from './components/Common'
import './help.css'

const topicFor = (question: string) =>
  helpTopics.find((topic) => topic.question === question) ??
  [...helpTopics].reverse().find((topic) => topic.terms.test(question))

export function HelpChat({ view }: { view: keyof typeof helpViews }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [entries, setEntries] = useState<{ question: string; answer?: string; fromModel?: boolean }[]>([])
  const log = useRef<HTMLDivElement>(null)
  const pending = useRef(false)
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight
  }, [entries, open])

  async function ask(question: string) {
    const cleaned = question.trim()
    if (!cleaned || pending.current) return
    pending.current = true
    setBusy(true)
    setInput('')
    setEntries((rows) => [...rows, { question: cleaned }])
    let answer = topicFor(cleaned)?.answer ||
      'Try asking about opening a repository, comparing revisions, tracing a file, or using Replay.'
    let fromModel = false
    if (import.meta.env.MODE !== 'example') {
      try {
        const { invoke } = await import('@forge/bridge')
        const history = entries.slice(-4).flatMap(({ question, answer }) => answer ? [{ question, answer }] : [])
        const response = await invoke<{ answer: string | null }>('help', { question: cleaned, view, history })
        const generated = ('body' in response ? response.body : response).answer
        if (generated) {
          answer = generated
          fromModel = true
        }
      } catch {
        // The built-in guide remains available if the provider cannot answer.
      }
    }
    setEntries((rows) => rows.map((row, index) => index === rows.length - 1 ? { ...row, answer, fromModel } : row))
    pending.current = false
    setBusy(false)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void ask(input)
  }

  return (
    <div className="desk-help desk-workspace">
      <button className="desk-help-open" type="button" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <CircleHelp size={17} aria-hidden="true" /> Help
      </button>
      <button className="desk-help-avatar" type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="Chat with BitLens" title="Chat with BitLens">
        <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
          <path d="M8 13a5 5 0 0 1 5-5h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5h-7l-5 4v-5a5 5 0 0 1-3-4z" fill="none" stroke="currentColor" strokeWidth="2"/>
          <path d="M14 17v2m8-2v2m-7 4c2 1.5 4 1.5 6 0M18 8V4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
      {open && (
        <Dialog title="Ask bitlens" close={() => setOpen(false)}>
          <div className="help-log" role="log" aria-label="Help conversation" ref={log}>
            {entries.map(({ question, answer, fromModel }, index) => (
              <div className="help-turn" key={index}>
                <p className="help-question">{question}</p>
                {answer && <small className="help-source">{fromModel ? 'AI response' : 'Built-in guide'}</small>}
                <p className="help-answer">{answer ?? 'Finding an answer…'}</p>
              </div>
            ))}
          </div>
          {!entries.length && (
            <div className="help-topics">
              {helpTopics.map(({ question }) => (
                <button type="button" key={question} onClick={() => void ask(question)}>{question}</button>
              ))}
            </div>
          )}
          <form className="help-form" onSubmit={submit}>
            <input aria-label="Ask how to use bitlens" placeholder="Ask how to use bitlens" value={input} maxLength={500} onChange={(event) => setInput(event.target.value)} />
            <button type="submit" className="button primary" aria-label="Send question" disabled={busy || !input.trim()}><ArrowUp size={18} aria-hidden="true" /></button>
          </form>
          <small className="help-hint">{import.meta.env.MODE === 'example' ? 'Preview uses the built-in guide. AI chat is available in the installed app.' : 'Ask about using BitLens. Keep tokens and private code out of chat.'}</small>
        </Dialog>
      )}
    </div>
  )
}
