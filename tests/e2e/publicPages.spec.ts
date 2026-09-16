import { test, expect } from '@playwright/test'

test.describe('Hospital Public Pages & Route Security', () => {
  test('homepage has hospital branding or navigation', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(/โรงพยาบาลเถิน|Thoen Hospital/)
  })

  test('appointment check page loads correctly', async ({ page }) => {
    const response = await page.goto('/check-date')
    expect(response?.status()).toBe(200)
  })

  test('protected member route redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/member/signature')
    await expect(page).toHaveURL(/.*\/member\/login/)
  })
})
