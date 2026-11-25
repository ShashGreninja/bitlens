import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowUp, CircleHelp } from 'lucide-react'
import { helpTopics } from '../../shared/help'
import { Dialog } from './components/Common'
import './help.css'

const topicFor = (question: string) =>
  helpTopics.find((topic) => topic.question === question) ??
  [...helpTopics].reverse().find((topic) => topic.terms.test(question))

export function HelpChat() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [entries, setEntries] = useState<{ question: string; answer?: string }[]>([])
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
    if (import.meta.env.MODE !== 'example') {
      try {
        const { invoke } = await import('@forge/bridge')
        const response = await invoke<{ answer: string | null }>('help', { question: cleaned })
        answer = ('body' in response ? response.body : response).answer ?? answer
      } catch {
        // The built-in guide remains available if the provider cannot answer.
      }
    }
    setEntries((rows) => rows.map((row, index) => index === rows.length - 1 ? { ...row, answer } : row))
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
      {open && (
        <Dialog title="Ask bitlens" close={() => setOpen(false)}>
          <div className="help-log" role="log" aria-label="Help conversation" ref={log}>
            {entries.map(({ question, answer }, index) => (
              <div className="help-turn" key={index}>
                <p className="help-question">{question}</p>
                <p>{answer ?? 'Finding an answer…'}</p>
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
          <small className="help-hint">Product help only. Keep tokens and private code out of chat.</small>
        </Dialog>
      )}
    </div>
  )
}
