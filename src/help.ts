import { chat, type Message } from '@forge/llm'
import { helpSystemPrompt, helpViews, type HelpTurn } from '../shared/help'

export async function answerHelp(question: unknown, view: unknown, previous: unknown): Promise<string | null> {
  if (typeof question !== 'string' || !question.trim() || question.length > 500)
    throw new Error('Enter a question of up to 500 characters.')
  const activeView = typeof view === 'string' && Object.hasOwn(helpViews, view)
    ? helpViews[view as keyof typeof helpViews]
    : undefined
  const history: HelpTurn[] = Array.isArray(previous)
    ? previous.slice(-4).flatMap((turn) =>
        turn && typeof turn.question === 'string' && typeof turn.answer === 'string'
          ? [{ question: turn.question.slice(0, 500), answer: turn.answer.slice(0, 1500) }]
          : [],
      )
    : []
  const system = helpSystemPrompt + (activeView ? '\nCurrent bitlens view: ' + activeView : '')
  const endpoint = process.env.BITLENS_HELP_URL
  if (!endpoint) {
    const messages: Message[] = [
      { role: 'system', content: system },
      ...history.flatMap<Message>(({ question, answer }) => [
        { role: 'user', content: question },
        { role: 'assistant', content: answer },
      ]),
      { role: 'user', content: question.trim() },
    ]
    const response = await chat({
      model: 'claude-haiku-4-5-20251001',
      messages,
      max_completion_tokens: 450,
    })
    const content = response.choices[0]?.message.content
    const answer = typeof content === 'string' ? content : content?.map((part) => part.text).join('')
    return answer?.trim().slice(0, 4000) || null
  }
  const url = new URL(endpoint)
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('Help provider configuration is invalid.')
  const token = process.env.BITLENS_HELP_TOKEN
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ system, question: question.trim(), history }),
  })
  if (!response.ok) throw new Error('The help provider is unavailable.')
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || !('answer' in data) ||
    typeof data.answer !== 'string' || !data.answer.trim() || data.answer.length > 4000)
    throw new Error('The help provider sent an invalid response.')
  return data.answer
}
