import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encodeSelection, decodeSelection } from '../shared/investigation'

test('sharing round-trips immutable revisions, event and punctuation in paths', () => {
  const selection = {
    base: '0'.repeat(40),
    target: 'a'.repeat(40),
    path: 'web/a #和?.ts',
    event: 'push:24',
    view: 'replay',
  }
  const url = new URL(
    encodeSelection(
      new URL('https://bitbucket.org/team/repo/forge/app?source=nav'),
      selection,
    ),
  )
  assert.deepEqual(decodeSelection(url.searchParams), selection)
  assert.equal(url.searchParams.get('source'), 'nav')
})

test('a floating revision or malformed shared URL cannot silently select a different commit', () => {
  assert.throws(() =>
    encodeSelection(new URL('https://example.org'), {
      base: 'main',
      target: 'a'.repeat(40),
    }),
  )
  assert.throws(() => decodeSelection(new URLSearchParams('investigation=1')))
  assert.equal(decodeSelection(new URLSearchParams()), null)
})
