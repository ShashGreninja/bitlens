import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('MCP adapter negotiates, lists read-only tools, serves exact snapshot, and rejects write tools', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bitlens-mcp-'))
  try {
    const file = join(dir, 'context.json')
    await writeFile(file, JSON.stringify({ schema: 'bitlens.context.v1', repository: 'team/repo', task: 'Review', commit: { hash: 'a'.repeat(40) }, base: null, changes: [], changesComplete: false }))
    const child = spawn(process.execPath, ['scripts/agent-mcp.mjs', file], { stdio: ['pipe', 'pipe', 'pipe'] })
    let output = '', error = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { error += chunk })
    const requests = [
      { id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } } },
      { method: 'notifications/initialized' },
      { id: 2, method: 'tools/list' },
      { id: 3, method: 'tools/call', params: { name: 'bitlens_context', arguments: {} } },
      { id: 4, method: 'tools/call', params: { name: 'bitlens_changes', arguments: {} } },
      { id: 5, method: 'tools/call', params: { name: 'run_pipeline', arguments: {} } },
      { id: 6, method: 'tools/call', params: { name: 'bitlens_context', arguments: { path: '/etc/passwd' } } },
    ]
    child.stdin.end(requests.map((r) => JSON.stringify({ jsonrpc: '2.0', ...r })).join('\n') + '\n')
    const code = await new Promise((resolve, reject) => { child.on('close', resolve); child.on('error', reject) })
    assert.equal(code, 0, error)
    const messages = output.trim().split('\n').map((s) => JSON.parse(s))
    assert.equal(messages.length, 6)
    assert.equal(messages[0].result.protocolVersion, '2025-11-25')
    assert.ok(messages[1].result.tools.every((t: any) => t.annotations.readOnlyHint))
    assert.equal(JSON.parse(messages[2].result.content[0].text).commit.hash, 'a'.repeat(40))
    assert.equal(JSON.parse(messages[3].result.content[0].text).complete, false)
    assert.equal(messages[4].error.code, -32602)
    assert.equal(messages[5].error.code, -32602)
  } finally { await rm(dir, { recursive: true, force: true }) }
})
