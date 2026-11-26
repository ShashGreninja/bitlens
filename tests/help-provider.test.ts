import assert from 'node:assert/strict'
import { test } from 'node:test'
import { helpConversation, openAIHelp } from '../src/helpProvider'

test('key-backed help sends the product guide, active view and prior turns to the model', async () => {
  const context = helpConversation(' Can I compare it? ', 'replay', [
    { question: 'Where is the old pointer?', answer: 'Open Replay.' },
  ])
  const answer = await openAIHelp(context, 'test-key', undefined, async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/chat/completions')
    assert.equal(new Headers(options.headers).get('Authorization'), 'Bearer test-key')
    const payload = JSON.parse(String(options.body))
    assert.equal(payload.store, false)
    assert.match(payload.messages[0].content, /Current BitLens view: Replay/)
    assert.match(payload.messages[0].content, /How do I compare two revisions/)
    assert.deepEqual(payload.messages.slice(1), [
      { role: 'user', content: 'Where is the old pointer?' },
      { role: 'assistant', content: 'Open Replay.' },
      { role: 'user', content: 'Can I compare it?' },
    ])
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Yes, compare before and after.' } }] }))
  })
  assert.equal(answer, 'Yes, compare before and after.')
})
