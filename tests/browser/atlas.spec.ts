import { expect, test } from '@playwright/test'
import source from '../../sample/bitbucket-public.json'

test('trace and move real Bitbucket commits on the primary graph', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open graph', exact: true }).click()
  const tip = source.refs.find((r) => r.name === source.main)!.hash
  const head = source.commits.find((c) => c.hash === tip)!
  const node = page.locator('[data-hash="' + tip + '"]')
  await expect(node).toBeVisible()
  await expect(page.locator('.atlas-inspector')).toContainText(head.author)
  await node.getByRole('button', { name: '2 parents' }).click()
  await expect(page.locator('.atlas-node')).toHaveCount(1)
  await node.getByRole('button', { name: '2 parents' }).click()
  const grip = await node.locator('.node-id').boundingBox()
  const x = grip!.x + 12,
    y = grip!.y + 8
  const before = await node.boundingBox()
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 34, y + 28, { steps: 8 })
  await page.mouse.up()
  expect((await node.boundingBox())!.x - before!.x).toBeGreaterThan(25)
  await page.getByLabel('Follow', { exact: true }).selectOption('first')
  await expect(
    page.locator('[data-hash="' + head.parents[1] + '"]'),
  ).toHaveCount(0)
  await page.getByLabel('Search loaded commits').fill(head.parents[1])
  await page.locator('.atlas-results button').first().click()
  await expect(page.locator('.atlas-inspector code')).toHaveText(
    head.parents[1].slice(0, 8),
  )
  await page.getByRole('button', { name: 'Share graph' }).click()
  const link = await page.getByLabel('Graph link').inputValue()
  await page.goto(link)
  await expect(page.getByLabel('Follow', { exact: true })).toHaveValue('first')
  await expect(page.locator('.atlas-inspector code')).toHaveText(
    head.parents[1].slice(0, 8),
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Fit map' }).click()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390)
})

test('pin two real commits, trace their paths, and return from Replay without losing the graph', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open graph', exact: true }).click()
  const tip = source.refs.find((ref) => ref.name === source.main)!.hash
  const parent = source.commits.find((commit) => commit.hash === tip)!
    .parents[0]
  await expect(page.locator('[data-hash="' + tip + '"]')).toBeVisible()
  await page.getByRole('button', { name: 'Pin target', exact: true }).click()
  await page.locator('[data-hash="' + parent + '"] .node-title').click()
  await page.getByRole('button', { name: 'Pin baseline', exact: true }).click()

  const range = page.getByRole('region', { name: 'Pinned range' })
  await expect(range).toContainText(parent.slice(0, 8))
  await expect(range).toContainText('Counts use loaded history')
  await range.getByRole('button', { name: 'Show both paths' }).click()
  await expect(page.locator('.pair-edge')).toHaveCount(1)

  const views = page.getByRole('navigation', { name: 'Repository views' })
  for (const name of ['Compare', 'File history', 'Source', 'Replay'])
    await expect(views.getByRole('button', { name, exact: true })).toBeVisible()
  await views.getByRole('button', { name: 'Replay', exact: true }).click()
  await expect(
    page.getByText(/Recording begins when Repository History is installed/),
  ).toBeVisible()
  await views.getByRole('button', { name: 'Graph', exact: true }).click()
  await expect(range).toBeVisible()
  await expect(page.locator('.pair-edge')).toHaveCount(1)
  await range.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(range).toHaveCount(0)
})

test('start from Home, pan the canvas, and zoom around the pointer', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'How to use it' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Open graph', exact: true }).click()
  const viewport = page.getByLabel('Draggable commit map')
  const tip = source.refs.find((ref) => ref.name === source.main)!.hash
  const node = page.locator('[data-hash="' + tip + '"]')
  await expect(node).toBeVisible()
  const before = (await node.boundingBox())!
  const bounds = (await viewport.boundingBox())!
  // Drag away from the initial graph origin, where scroll-based panning cannot move.
  const anchor = { x: bounds.x + 12, y: bounds.y + 14 }
  await page.mouse.move(anchor.x, anchor.y)
  await page.mouse.down()
  await page.mouse.move(anchor.x + 60, anchor.y + 42, { steps: 6 })
  await page.mouse.up()
  const moved = (await node.boundingBox())!
  expect(moved.x - before.x).toBeCloseTo(60)
  expect(moved.y - before.y).toBeCloseTo(42)
  await page.mouse.move(anchor.x, anchor.y)
  await page.mouse.wheel(0, -150)
  await expect
    .poll(async () => (await node.boundingBox())!.width)
    .toBeGreaterThan(moved.width)
  const zoomed = (await node.boundingBox())!
  expect((zoomed.x - anchor.x) / zoomed.width).toBeCloseTo(
    (moved.x - anchor.x) / moved.width,
    2,
  )
  await viewport.focus()
  await page.keyboard.press('0')
  await expect(node).toBeInViewport()
})
