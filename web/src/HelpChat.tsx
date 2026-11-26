import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowUp, CircleHelp, MessageCircleMore } from 'lucide-react'
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
    try {
      const history = entries.slice(-4).flatMap(({ question, answer, fromModel }) =>
        answer && fromModel ? [{ question, answer }] : [],
      )
      const request = { question: cleaned, view, history }
      let generated: string | null = null
      if (import.meta.env.MODE === 'example') {
        const response = await fetch('/__bitlens/help', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })
        if (response.ok) generated = (await response.json()).answer
      } else {
        const { invoke } = await import('@forge/bridge')
        const response = await invoke<{ answer: string | null }>('help', request)
        generated = ('body' in response ? response.body : response).answer
      }
      if (typeof generated === 'string' && generated.trim()) {
        answer = generated
        fromModel = true
      }
    } catch {
      // Keep the built-in guide available when the model is offline.
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
        <MessageCircleMore size={26} strokeWidth={1.8} aria-hidden="true" />
      </button>
      {open && (
        <Dialog title="Ask bitlens" variant="drawer" close={() => setOpen(false)}>
          {!entries.length && <p className="help-intro">Ask how to trace a commit, compare revisions, or use another BitLens tool.</p>}
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
          <small className="help-hint">Keep API keys and private code out of chat.</small>
        </Dialog>
      )}
    </div>
  )
}
