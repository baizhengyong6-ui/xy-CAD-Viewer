import { expect, test } from '@playwright/test'

test('keyboard shortcuts open the cheat sheet, a sample, and distance', async ({ page }) => {
  await page.goto('./')
  await page.keyboard.press('Shift+Slash')
  const dialog = page.getByTestId('shortcuts-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('D')
  await expect(dialog).toContainText('距离')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)

  await page.keyboard.press('s')
  await expect(page.getByTestId('sample-measure-fixture')).toBeVisible()
  await page.keyboard.press('d')
  await expect(page.getByTestId('sample-measure-fixture')).toBeVisible()
  await page.getByTestId('sample-measure-fixture').click()
  await expect(page.getByTestId('file-name')).toContainText('measure-fixture.dxf')
  await expect(page.getByTestId('stage')).toHaveAttribute('data-view-ready', 'true')

  await page.getByTestId('scale-input').focus()
  await page.keyboard.press('a')
  await expect(page.getByTestId('tool-area')).not.toHaveClass(/on/)
  await page.getByTestId('scale-input').blur()

  await page.keyboard.press('r')
  await expect(page.getByTestId('recent-panel')).toHaveClass(/collapsed/)

  await page.keyboard.press('d')
  await expect(page.getByTestId('tool-distance')).toHaveClass(/on/)
  await expect(page.getByText('指定第一个点').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('tool-distance')).not.toHaveClass(/on/)

  await page.keyboard.press('p')
  await expect(page.getByTestId('tool-pan')).toHaveClass(/on/)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('tool-pan')).not.toHaveClass(/on/)

  const chooser = page.waitForEvent('filechooser')
  await page.keyboard.press('Control+o')
  await chooser
})
