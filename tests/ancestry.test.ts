import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToAncestor, tracePair } from '../shared/ancestry'
import type { Commit } from '../shared/types'

const record = (hash: string, ...parents: string[]): Commit => ({
  hash,
  parents,
  message: hash,
  author: '',
  date: '',
  url: '',
})

test('finds both common ancestors of a criss-cross merge and reports missing history', () => {
  const nodes = [
    record('left', 'a', 'b'),
    record('right', 'b', 'a'),
    record('a', 'root'),
    record('b', 'root'),
  ]
  const records = new Map(nodes.map((commit) => [commit.hash, commit]))
  const partial = tracePair(records, 'left', 'right')
  assert.deepEqual(partial.leftOnly, ['left'])
  assert.deepEqual(partial.rightOnly, ['right'])
  assert.deepEqual(new Set(partial.frontier), new Set(['a', 'b']))
  assert.deepEqual(partial.missing, ['root'])
  records.set('root', record('root'))
  const complete = tracePair(records, 'left', 'right')
  assert.equal(complete.incomplete, false)
  assert.deepEqual(new Set(complete.frontier), new Set(['a', 'b']))
  assert.deepEqual(pathToAncestor(records, 'right', 'a'), ['right', 'a'])
  assert.deepEqual(pathToAncestor(records, 'root', 'left'), [])
})
