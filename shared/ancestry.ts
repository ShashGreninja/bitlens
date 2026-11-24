import type { Commit } from './types'

function reachable(records: ReadonlyMap<string, Commit>, tip: string) {
  const commits = new Set<string>()
  const missing = new Set<string>()
  const pending = [tip]
  while (pending.length) {
    const id = pending.pop()!
    if (commits.has(id) || missing.has(id)) continue
    const record = records.get(id)
    if (!record) {
      missing.add(id)
      continue
    }
    commits.add(id)
    pending.push(...record.parents)
  }
  return { commits, missing }
}

export function tracePair(
  records: ReadonlyMap<string, Commit>,
  base: string,
  target: string,
) {
  const left = reachable(records, base)
  const right = reachable(records, target)
  const shared = new Set(
    [...left.commits].filter((id) => right.commits.has(id)),
  )
  const older = new Set<string>()
  for (const id of shared) {
    for (const parent of records.get(id)!.parents)
      if (shared.has(parent)) older.add(parent)
  }
  return {
    leftOnly: [...left.commits].filter((id) => !shared.has(id)),
    rightOnly: [...right.commits].filter((id) => !shared.has(id)),
    shared,
    frontier: [...shared].filter((id) => !older.has(id)),
    missing: [...new Set([...left.missing, ...right.missing])],
    incomplete: Boolean(left.missing.size || right.missing.size),
  }
}

export function pathToAncestor(
  records: ReadonlyMap<string, Commit>,
  start: string,
  end: string,
) {
  const queue = [start]
  const child = new Map<string, string | null>([[start, null]])
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index]
    if (id === end) {
      const path = []
      for (let step: string | null = id; step !== null; step = child.get(step)!)
        path.push(step)
      return path.reverse()
    }
    for (const parent of records.get(id)?.parents || []) {
      if (!child.has(parent) && records.has(parent)) {
        child.set(parent, id)
        queue.push(parent)
      }
    }
  }
  return []
}
