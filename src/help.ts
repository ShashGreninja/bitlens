import { helpSystemPrompt } from '../shared/help'

export async function answerHelp(question: unknown): Promise<string | null> {
  if (typeof question !== 'string' || !question.trim() || question.length > 500)
    throw new Error('Enter a question of up to 500 characters.')
  const endpoint = process.env.BITLENS_HELP_URL
  if (!endpoint) return null
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
    body: JSON.stringify({ system: helpSystemPrompt, question: question.trim() }),
  })
  if (!response.ok) throw new Error('The help provider is unavailable.')
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || !('answer' in data) ||
    typeof data.answer !== 'string' || !data.answer.trim() || data.answer.length > 4000)
    throw new Error('The help provider sent an invalid response.')
  return data.answer
}
