import { helpSystemPrompt, helpViews, type HelpTurn } from '../shared/help'

export function helpConversation(question: unknown, view: unknown, previous: unknown) {
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
  const system = helpSystemPrompt + (activeView ? '\nCurrent BitLens view: ' + activeView : '')
  return { system, question: question.trim(), history }
}

export type HelpConversation = ReturnType<typeof helpConversation>

export function helpMessages({ system, question, history }: HelpConversation) {
  return [
    { role: 'system' as const, content: system },
    ...history.flatMap((turn) => [
      { role: 'user' as const, content: turn.question },
      { role: 'assistant' as const, content: turn.answer },
    ]),
    { role: 'user' as const, content: question },
  ]
}

export async function openAIHelp(
  conversation: HelpConversation,
  key: string,
  model = 'gpt-4.1-mini',
  request: (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'json'>> = fetch,
) {
  const response = await request('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(12_000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: helpMessages(conversation),
      max_completion_tokens: 600,
      store: false,
    }),
  })
  if (!response.ok) throw new Error('The help model is unavailable.')
  const data = await response.json() as { choices?: { message?: { content?: unknown } }[] }
  const content = data.choices?.[0]?.message?.content
  return typeof content === 'string' ? content.trim().slice(0, 4000) || null : null
}
