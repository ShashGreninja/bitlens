import { expect, test } from '@playwright/test'
import records from '../../sample/history.json'

const tag = (name: string) =>
  records.refs.find((ref) => ref.name === name)!.hash
const path = 'services/payments/config.yml'

test('follow the renamed configuration to its landing PR and commit graph', async ({
  page,
  context,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
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
  await page.goto('/')
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
  await page.goto('/')
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
  await page.goto('/?investigation=1&base=main')
  await expect(page.getByRole('alert')).toContainText(
    'incomplete or unsupported',
  )
  await page.getByRole('link', { name: 'Start a new investigation' }).click()
  await expect(page.getByRole('region', { name: 'Unified diff' })).toBeVisible()
})
