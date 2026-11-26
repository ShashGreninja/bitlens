import { stripVTControlCharacters } from 'node:util'

export type Row = {
  label: string
  meta?: string
  detail?: string[]
  hash?: string
  tone?: 'accent' | 'muted'
  open?: () => Promise<Pane>
}

export type Pane = {
  tab: string
  title: string
  rows: Row[]
  note?: string
  next?: () => Promise<Pane>
}

export const tabs = ['Commits', 'Refs', 'Compare', 'Source'] as const

const esc = '\x1b['
export const terminal = {
  enter: esc + '?1049h' + esc + '?25l',
  leave: esc + '0m' + esc + '?25h' + esc + '?1049l',
}

export function terminalText(value: string) {
  return stripVTControlCharacters(value)
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu, ' ')
}

function fit(text: string, width: number) {
  const safe = terminalText(text)
  const chars = Array.from(safe)
  // Count wide terminal glyphs conservatively to avoid writing into the final column.
  let cells = 0
  let end = 0
  while (end < chars.length) {
    const char = chars[end]
    const length = /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7ff\uff01-\uff60]|\p{Extended_Pictographic}/u.test(char) ? 2 : 1
    if (cells + length > width) break
    cells += length
    end++
  }
  if (end === chars.length) return safe
  return width > 1 ? chars.slice(0, Math.max(0, end - 1)).join('') + '…' : ''
}

export function pageSize(height: number) {
  return Math.max(1, height - 12)
}

export function drawScreen(view: {
  pane: Pane; index: number; width: number; height: number
  repo: string; base?: string; target?: string; graph: string
  busy: boolean; message: string; colorDepth: number
}) {
  const { pane, index, height } = view
  const width = Math.max(0, view.width - 1)
  const colors = view.colorDepth >= 4
  const palette = view.colorDepth >= 24
    ? { panel: '48;2;20;19;18', ink: '38;2;235;226;219', accent: '38;2;240;159;105', muted: '38;2;174;162;153' }
    : view.colorDepth >= 8
      ? { panel: '48;5;233', ink: '38;5;253', accent: '38;5;215', muted: '38;5;248' }
      : { panel: '40', ink: '97', accent: '93', muted: '37' }
  const paint = (color: string, text: string) =>
    colors ? esc + color + 'm' + text + esc + palette.ink + 'm' : text
  const accent = (text: string) => paint(palette.accent, text)
  const muted = (text: string) => paint(palette.muted, text)
  const short = (value?: string) => value ? value.slice(0, 8) : '—'
  const lines: string[] = []
  const line = (value = '', style: (text: string) => string = (text) => text) => {
    lines.push(style(fit(value, width)) + esc + 'K')
  }

  if (width < 35 || height < 14) {
    line('BitLens · enlarge the terminal (q to quit)', accent)
  } else {
    line(' BitLens   /   ' + view.repo, accent)
    line(' ' + tabs.map((name, i) => name === pane.tab ? '[' + (i + 1) + ' ' + name + ']' : (i + 1) + ' ' + name).join('  '), muted)
    line(' ' + pane.title, accent)
    line(' Graph ' + short(view.graph) + '   Base ' + short(view.base) + '   Target ' + short(view.target), muted)
    line(' ' + '─'.repeat(width - 1), muted)
    const limit = pageSize(height)
    const start = Math.min(Math.max(0, index - Math.floor(limit / 2)), Math.max(0, pane.rows.length - limit))
    const window = pane.rows.slice(start, start + limit)
    if (window.length === 0) line('   No records here.', muted)
    for (const [rowIndex, row] of window.entries()) {
      const selected = rowIndex + start === index
      const label = (selected ? ' › ' : '   ') + row.label + (row.meta ? '   ' + row.meta : '')
      line(label, selected || row.tone === 'accent' ? accent : row.tone === 'muted' ? muted : undefined)
    }
    line()
    const selected = pane.rows[index]
    for (const detail of selected?.detail?.slice(0, 2) ?? []) line('   ' + detail, muted)
    const position = pane.rows.length ? (index + 1) + '/' + pane.rows.length : ''
    line(' ' + [position, pane.next && 'n more', pane.note].filter(Boolean).join(' · '), muted)
    if (view.busy || view.message) line(' ' + (view.busy ? 'Reading repository…' : view.message), accent)
    lines.push(esc + 'K')
    line(width < 72 ? ' ↑↓ move · Enter open · ? keys · q quit' : ' ↑↓ move   Enter open   b base   t target   c compare   Esc back   ? keys   q quit', muted)
  }

  return esc + 'H' + (colors ? esc + palette.panel + ';' + palette.ink + 'm' : '') +
    lines.slice(0, height).join('\r\n') + esc + 'J' + esc + '0m'
}
