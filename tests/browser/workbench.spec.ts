import { expect, test } from '@playwright/test'
import source from '../../sample/history.json'

test('graph workbench exports revision context and prevents writes in preview', async ({ page }) => {
  await page.goto('/?fixture=1&walkthrough=release')
  await page.getByRole('navigation', { name: 'Repository views' }).getByRole('button', { name: 'Graph', exact: true }).click()
  const workbench = page.getByRole('region', { name: 'Commit workbench' })
  await expect(workbench).toContainText('Preview mode')
  await workbench.getByRole('button', { name: 'Pipelines', exact: true }).click()
  await expect(workbench.getByRole('button', { name: 'Run pipeline', exact: true })).toBeDisabled()
  await workbench.getByRole('button', { name: 'Agent handoff', exact: true }).click()
  await workbench.getByLabel('Task for your agent').fill('Find the regression and propose a test.')
  await workbench.getByRole('button', { name: 'Prepare agent handoff', exact: true }).click()
  const tip = source.refs.find((r) => r.name === 'main')!.hash
  const context = workbench.getByRole('textbox', { name: 'Agent context', exact: true })
  await expect(context).toHaveValue(new RegExp(tip))
  await expect(context).toHaveValue(/Find the regression and propose a test\./)
  await expect(context).toHaveValue(/untrusted repository content/)
  const downloaded = page.waitForEvent('download')
  await workbench.getByRole('button', { name: 'Download context JSON' }).click()
  const file = await downloaded
  expect(file.suggestedFilename()).toBe(`bitlens-${tip.slice(0, 8)}.json`)
  const stream = await file.createReadStream()
  let body = ''
  for await (const chunk of stream!) body += chunk.toString()
  const bundle = JSON.parse(body)
  expect(bundle.commit.hash).toBe(tip)
  expect(bundle.changes.length).toBeGreaterThan(0)
  expect(bundle.schema).toBe('bitlens.context.v1')
  await workbench.getByLabel('Task for your agent').fill('A different task')
  await expect(context).toHaveCount(0)
  await workbench.getByText('Connect an MCP-compatible agent', { exact: true }).click()
  await expect(workbench).toContainText('scripts/agent-mcp.mjs')
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 960 })
    await workbench.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.screenshot({ path: `test-results/workbench-${width}.png`, fullPage: true })
  }
})

test('selecting another graph commit resets exported context to that revision', async ({ page }) => {
  await page.goto('/?fixture=1&walkthrough=release')
  await page.getByRole('navigation', { name: 'Repository views' }).getByRole('button', { name: 'Graph', exact: true }).click()
  const workbench = page.getByRole('region', { name: 'Commit workbench' })
  await workbench.getByRole('button', { name: 'Agent handoff', exact: true }).click()
  await workbench.getByRole('button', { name: 'Prepare agent handoff', exact: true }).click()
  await expect(workbench.getByRole('textbox', { name: 'Agent context', exact: true })).toBeVisible()
  const tip = source.refs.find((r) => r.name === 'main')!.hash
  const parent = source.commits[tip as keyof typeof source.commits].parents[0]
  await page.locator(`[data-hash="${parent}"] .node-title`).click()
  await expect(workbench).toContainText(parent.slice(0, 8))
  await expect(workbench.getByRole('textbox', { name: 'Agent context', exact: true })).toHaveCount(0)
})
