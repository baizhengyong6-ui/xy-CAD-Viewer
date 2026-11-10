import { expect, test } from '@playwright/test'

test('opens a DXF sample and measures a 100-unit distance', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('open-samples').click()
  await page.getByTestId('sample-measure-fixture').click()
  await expect(page.getByTestId('file-name')).toContainText('measure-fixture.dxf')
  await expect(page.getByTestId('stage')).toHaveAttribute('data-view-ready', 'true')
  await page.getByTestId('recent-collapse').click()
  await page.getByTestId('zoom-extents').click()

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const start = window.lantu.worldToClient(0, 0)
        const end = window.lantu.worldToClient(100, 0)
        const host = document.querySelector('[data-testid="viewer-host"]')?.getBoundingClientRect()
        if (!start || !end || !host) return false
        const inside = (point: { x: number; y: number }) =>
          point.x > host.left + 8 &&
          point.y > host.top + 8 &&
          point.x < host.right - 8 &&
          point.y < host.bottom - 8
        return inside(start) && inside(end)
      })
    })
    .toBe(true)

  await page.getByTestId('tool-distance').click()
  const points = await page.evaluate(() => ({
    start: window.lantu.worldToClient(0, 0),
    end: window.lantu.worldToClient(100, 0),
  }))
  if (!points.start || !points.end) throw new Error('measurement points are not on screen')
  await page.mouse.click(points.start.x, points.start.y)
  await page.mouse.click(points.end.x, points.end.y)

  await expect(page.getByTestId('measure-list')).toContainText(/100(\.0+)?/)
})
