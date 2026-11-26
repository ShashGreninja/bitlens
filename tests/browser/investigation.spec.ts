import { expect, test } from '@playwright/test'
import records from '../../sample/history.json'

const tag = (name: string) =>
  records.refs.find((ref) => ref.name === name)!.hash
const path = 'services/payments/config.yml'

test('tab headings and shared controls stay fixed, and chat keeps the active view and conversation', async ({ page }) => {
  await page.goto('/?fixture=1&walkthrough=release')
  const nav = page.getByRole('navigation', { name: 'Repository views' })
  const chatButton = page.getByRole('button', { name: 'Chat with BitLens' })
  const heading = page.getByRole('heading', { level: 1 })
  let anchor
  for (const name of ['Graph', 'Compare', 'File history', 'Source', 'Replay']) {
    await nav.getByRole('button', { name, exact: true }).click()
    await expect(heading).toBeVisible()
    const { x, y } = (await heading.boundingBox())!
    const position = { x, y, nav: await nav.boundingBox(), chat: await chatButton.boundingBox() }
    if (anchor) expect(position).toEqual(anchor)
    else anchor = position
  }

  const requests: unknown[] = []
  await page.route('**/__bitlens/help', async (route) => {
    requests.push(route.request().postDataJSON())
    await route.fulfill({ json: { answer: 'Use Replay to compare the two recorded pointers.' } })
  })
  await chatButton.click()
  const drawer = page.getByRole('dialog', { name: 'Ask bitlens' })
  await expect(drawer).toHaveClass(/bitlens-drawer/)
  const input = drawer.getByRole('textbox', { name: 'Ask how to use bitlens' })
  for (const [index, question] of ['Where do I see the old pointer?', 'Can I compare it?'].entries()) {
    await input.fill(question)
    await drawer.getByRole('button', { name: 'Send question' }).click()
    await expect(drawer.getByRole('log').getByText('AI response')).toHaveCount(index + 1)
    await expect(drawer.getByRole('log').getByText(question, { exact: true })).toBeVisible()
  }
  await expect.poll(() => requests).toEqual([
    { view: 'replay', question: 'Where do I see the old pointer?', history: [] },
    { view: 'replay', question: 'Can I compare it?', history: [{ question: 'Where do I see the old pointer?', answer: 'Use Replay to compare the two recorded pointers.' }] },
  ])
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
})

test('home actions stay readable and the workspace can be rearranged', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Trace what changed\.\s*Visually\./)
  await expect(page.getByRole('link', { name: 'Try the release example' })).toHaveCSS('color', 'rgb(23, 20, 18)')
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  }
  await page.getByRole('button', { name: 'Chat with BitLens' }).click()
  const chat = page.getByRole('dialog', { name: 'Ask bitlens' })
  await chat.getByRole('button', { name: 'What does Replay record?' }).click()
  await expect(chat.getByRole('log')).toContainText('Built-in guide')
  await expect(chat.getByRole('log')).toContainText('Replay shows branch and tag changes')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Help', exact: true })).toBeVisible()

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('link', { name: 'Try the release example' }).click()
  await page.getByRole('button', { name: 'Compare revisions', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Unified diff' })).toBeVisible()
  const files = page.locator('.file-panel')
  const divider = page.getByRole('separator', { name: 'Resize Compare panes' })
  const before = (await files.boundingBox())!
  const handle = (await divider.boundingBox())!
  await page.mouse.move(handle.x + 8, handle.y + 30)
  await page.mouse.down()
  await page.mouse.move(handle.x + 88, handle.y + 30, { steps: 6 })
  await page.mouse.up()
  expect((await files.boundingBox())!.width).toBeGreaterThan(before.width + 60)

  const corner = page.getByRole('separator', { name: 'Resize Compare workspace height' })
  const grip = (await corner.boundingBox())!
  await page.mouse.move(grip.x + 10, grip.y + 10)
  await page.mouse.down()
  await page.mouse.move(grip.x + 10, grip.y + 58, { steps: 6 })
  await page.mouse.up()
  expect((await files.boundingBox())!.height).toBeGreaterThan(before.height + 35)
  await page.getByRole('button', { name: 'Swap Compare panes' }).click()
  expect((await files.boundingBox())!.x).toBeGreaterThan(before.x + 100)
  await page.setViewportSize({ width: 390, height: 900 })
  await expect(divider).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('investigate and share a release from the same workspace UI used on Forge', async ({
  page,
  browser,
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Try the release example' }).click()
  const views = page.getByRole('navigation', { name: 'Repository views' })
  await expect(page.getByText('Local Git fixture', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Compare revisions', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Unified diff' })).toContainText('+timeout_ms: 600')
  await expect(page.getByText('Renamed from')).toContainText('payments/config.yml')
  await page.getByRole('button', { name: 'View file history' }).click()
  await expect(page.getByRole('link', { name: /PR #42/ })).toBeVisible()
  await page.getByRole('button', { name: 'View in graph' }).first().click()
  await expect(page.getByLabel('Draggable commit map')).toBeVisible()
  await views.getByRole('button', { name: 'Replay', exact: true }).click()
  const deletion = records.events.find((event) => event.kind === 'delete')!
  await page.getByRole('button', { name: /Deleted.*feature\/payment-timeout/ }).click()
  await page.getByRole('button', { name: 'Share investigation' }).click()
  const link = await page.getByLabel('Investigation link').inputValue()
  const params = new URL(link).searchParams
  expect(params.get('base')).toBe(tag('v1.4'))
  expect(params.get('target')).toBe(tag('v1.5'))
  expect(params.get('path')).toBe(path)
  expect(params.get('event')).toBe(deletion.id)
  await expect(page.getByLabel('Markdown summary')).toHaveValue(
    /Previous path: .*payments\/config\.yml/,
  )
  await expect(page.getByLabel('Markdown summary')).toHaveValue(
    /Deleted branch .*feature\/payment-timeout/,
  )
  await expect(page.getByLabel('Markdown summary')).toHaveValue(
    new RegExp('Before: .*' + deletion.before),
  )

  const fresh = await browser.newContext()
  try {
    const recipient = await fresh.newPage()
    await recipient.goto(link)
    const recipientViews = recipient.getByRole('navigation', { name: 'Repository views' })
    await expect(recipient.getByRole('heading', { name: 'Deleted', exact: true })).toBeVisible()
    await expect(recipient.locator('.pointer').first()).toContainText(deletion.before!)
    await recipientViews.getByRole('button', { name: 'Compare', exact: true }).click()
    await expect(recipient.getByRole('region', { name: 'Unified diff' })).toContainText('+timeout_ms: 600')
    await recipient.getByRole('button', { name: 'Share investigation' }).click()
    await expect(recipient.getByLabel('Markdown summary')).toHaveValue(
      /Deleted branch .*feature\/payment-timeout/,
    )
  } finally {
    await fresh.close()
  }
})

test('follow the renamed configuration to its landing PR and commit graph', async ({
  page,
  context,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/?fixture=1')
  const diff = page.getByRole('region', { name: 'Unified diff' })
  await expect(diff).toContainText('-timeout_ms: 1800')
  await expect(diff).toContainText('+timeout_ms: 600')
  await expect(page.getByText('Renamed from')).toContainText(
    'payments/config.yml',
  )
  await page.getByRole('button', { name: 'View file history' }).click()
  await expect(
    page
      .getByRole('textbox', { name: 'File path' })
      .or(page.getByRole('combobox', { name: 'File path' })),
  ).toHaveValue(path)
  await expect(
    page.getByText('payments/config.yml', { exact: true }).first(),
  ).toBeVisible()
  const newPage = context.waitForEvent('page')
  await page.getByRole('link', { name: /PR #42/ }).click()
  const evidence = await newPage
  await expect(evidence.getByRole('heading', { name: /#42/ })).toBeVisible()
  await expect(evidence.getByText('Squash', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'View in graph' }).first().click()
  await expect(
    page.getByRole('img', { name: /Commit ancestry diagram/ }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: /Merge the payment incident runbook/ })
    .click()
  await expect(page.locator('.evidence-card .hash-pill')).toHaveCount(2)
  expect(errors).toEqual([])
})

test('open a shared deletion record in a fresh browser context', async ({
  page,
  browser,
}) => {
  await page.goto('/?fixture=1')
  await expect(page.getByRole('region', { name: 'Unified diff' })).toBeVisible()
  await page.getByRole('button', { name: 'Replay', exact: true }).click()
  const moved = records.events.find((event) => event.kind === 'force-push')!
  await page.getByRole('button', { name: /Force-pushed/ }).click()
  await expect(page.locator('.pointer').first()).toContainText(moved.before!)
  await expect(page.locator('.pointer').last()).toContainText(moved.after!)
  await page
    .getByRole('button', { name: 'Show ancestry at this event' })
    .click()
  await expect(page.locator('.large-hash')).toHaveText(moved.after!.slice(0, 7))
  await page.getByRole('button', { name: 'Before event' }).click()
  await expect(page.locator('.large-hash')).toHaveText(
    moved.before!.slice(0, 7),
  )
  await page.getByRole('slider', { name: 'Replay position' }).focus()
  await page.keyboard.press('Home')
  await expect(
    page.getByRole('heading', { name: 'Pointer snapshot', exact: true }),
  ).toBeVisible()
  const deletion = records.events.find((event) => event.kind === 'delete')!
  await page
    .getByRole('button', { name: /Deleted.*feature\/payment-timeout/ })
    .click()
  await page.getByRole('button', { name: 'Share investigation' }).click()
  const link = await page.getByLabel('Investigation link').inputValue()
  const params = new URL(link).searchParams
  expect(params.get('base')).toBe(tag('v1.4'))
  expect(params.get('target')).toBe(tag('v1.5'))
  expect(params.get('path')).toBe(path)
  expect(params.get('event')).toBe(deletion.id)
  await expect(page.getByLabel('Markdown summary')).toHaveValue(
    new RegExp(deletion.id),
  )
  const fresh = await browser.newContext()
  try {
    const recipient = await fresh.newPage()
    await recipient.goto(link)
    await expect(
      recipient.getByRole('heading', { name: 'Deleted', exact: true }),
    ).toBeVisible()
    await expect(recipient.locator('.pointer').first()).toContainText(
      deletion.before!,
    )
    await expect(recipient.locator('.pointer').last()).toContainText(
      'No pointer recorded',
    )
  } finally {
    await fresh.close()
  }
})

test('browse both source trees and reverse a comparison by raw hash on a narrow screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?fixture=1')
  await page.getByRole('button', { name: 'Browse source' }).click()
  const tree = page.getByRole('dialog', { name: 'Source tree' })
  await tree.getByRole('button', { name: 'Target', exact: true }).click()
  await tree.getByRole('button', { name: 'services', exact: true }).click()
  await tree.getByRole('button', { name: 'payments', exact: true }).click()
  await expect(tree.getByRole('link', { name: 'config.yml' })).toBeVisible()
  await tree.getByRole('button', { name: 'Baseline', exact: true }).click()
  await tree.getByRole('button', { name: 'payments', exact: true }).click()
  await expect(tree.getByRole('link', { name: 'config.yml' })).toBeVisible()
  await tree.getByRole('button', { name: 'Close dialog' }).click()
  await page.getByRole('button', { name: /Select target revision/ }).click()
  const query = page.getByRole('textbox', { name: /Find a revision/ })
  await query.fill(tag('v1.5'))
  await query.press('Enter')
  await page.getByRole('button', { name: 'Swap baseline and target' }).click()
  await expect(
    page.getByRole('region', { name: 'Unified diff' }),
  ).toContainText('+timeout_ms: 1800')
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390)
})

test('surface a malformed investigation and recover to the default comparison', async ({
  page,
}) => {
  await page.goto('/?fixture=1&investigation=1&base=main')
  await expect(page.getByRole('alert')).toContainText(
    'incomplete or unsupported',
  )
  await page.getByRole('link', { name: 'Start a new investigation' }).click()
  await expect(page.getByRole('region', { name: 'Unified diff' })).toBeVisible()
})
