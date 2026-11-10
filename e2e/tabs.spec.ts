import { expect, test } from '@playwright/test'

test('opens two drawings in separate tabs and switches between them', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('open-samples').click()
  await page.getByTestId('sample-measure-fixture').click()
  await expect(page.getByTestId('file-name')).toContainText('measure-fixture.dxf')
  await expect(page.getByTestId('stage')).toHaveAttribute('data-view-ready', 'true')

  await page.getByTestId('open-samples').click()
  await page.getByTestId('sample-entities').click()
  await expect(page.getByTestId('file-name')).toContainText('entities.dxf')
  await expect(page.getByTestId('tab-bar').getByRole('tab')).toHaveCount(2)

  await page.getByRole('tab', { name: /measure-fixture\.dxf/ }).click()
  await expect(page.getByTestId('file-name')).toContainText('measure-fixture.dxf')
  await expect(page.getByRole('tab', { name: /measure-fixture\.dxf/ })).toHaveAttribute('aria-selected', 'true')

  await page.getByTestId('open-samples').click()
  await page.getByTestId('sample-measure-fixture').click()
  await expect(page.getByTestId('tab-bar').getByRole('tab')).toHaveCount(2)
  await expect(page.getByTestId('file-name')).toContainText('measure-fixture.dxf')
})
