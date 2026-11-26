import { fetch as forgeFetch } from '@forge/api'
import { chat } from '@forge/llm'
import { helpConversation, helpMessages, openAIHelp } from './helpProvider'

export async function answerHelp(question: unknown, view: unknown, previous: unknown): Promise<string | null> {
  const conversation = helpConversation(question, view, previous)
  const key = process.env.BITLENS_OPENAI_API_KEY
  if (key) return openAIHelp(conversation, key, process.env.BITLENS_OPENAI_MODEL, (url, init) =>
    forgeFetch(url, {
      method: init.method,
      headers: init.headers as Record<string, string>,
      body: String(init.body),
      redirect: 'error',
      signal: init.signal ?? undefined,
    }),
  )
  const endpoint = process.env.BITLENS_HELP_URL
  if (!endpoint) {
    const response = await chat({
      model: 'claude-haiku-4-5-20251001',
      messages: helpMessages(conversation),
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
    body: JSON.stringify(conversation),
  })
  if (!response.ok) throw new Error('The help provider is unavailable.')
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || !('answer' in data) ||
    typeof data.answer !== 'string' || !data.answer.trim() || data.answer.length > 4000)
    throw new Error('The help provider sent an invalid response.')
  return data.answer
}
