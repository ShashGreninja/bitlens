export type Ref = { name: string; hash: string; kind: 'branch' | 'tag' }
export type Commit = {
  hash: string
  parents: string[]
  message: string
  author: string
  date: string
  url: string
}
export type Change = {
  status: string
  oldPath: string | null
  newPath: string | null
  added: number
  removed: number
}
export type Revision = {
  hash: string
  path: string
  message: string
  date: string
  author: string
  url: string
  pr?: { id: number; title: string; url: string }
}
export type ReplayEvent = {
  id: string
  ref: string
  refType: 'branch' | 'tag'
  kind: string
  before: string | null
  after: string | null
  actor: string
  date: string
  gap?: boolean
}
export type Results = {
  bootstrap: {
    repo: string
    workspace: string
    defaultBranch: string
    refs: Ref[]
    webUrl: string
    partial?: boolean
  }
  compare: { base: string; target: string; changes: Change[]; next?: string }
  detail: { diff: string; history: Revision[]; next?: string; warning?: string }
  graph: { commits: Commit[]; next?: string }
  replay: {
    since: string | null
    events: ReplayEvent[]
    next?: string
    warning?: string
  }
  tree: {
    entries: { path: string; directory: boolean; url: string }[]
    next?: string
  }
}
export type Params = {
  base?: string
  target?: string
  path?: string
  oldPath?: string
  cursor?: string
  deleted?: boolean
}
export type Service = <K extends keyof Results>(
  op: K,
  params?: Params,
) => Promise<Results[K]>
