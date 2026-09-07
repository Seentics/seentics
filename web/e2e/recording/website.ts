import { expect, type Page } from '@playwright/test';

/** Create a site through the dashboard and return the exact snippet the UI displays. */
export async function createWebsiteAndReadSnippet(page: Page, name: string, url: string) {
  const onboarding = page.getByRole('heading', { name: 'Add your website' });
  // After sign-in, `/websites` either renders the first-site form or redirects to
  // the existing site's dashboard. Wait for that decision instead of assuming an
  // order between the recording and heatmap specs.
  await expect.poll(async () =>
    await onboarding.isVisible() || /^https?:\/\/[^/]+\/websites\/[^/]+/.test(page.url()),
  ).toBe(true);

  let created;
  if (await onboarding.isVisible()) {
    await page.getByLabel('Website name').fill(name);
    await page.getByLabel('Website domain').fill(url);
    created = page.waitForResponse(r => r.url().endsWith('/user/websites') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Add website', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Tracking code' })).toBeVisible();
  } else {
    await page.goto('/websites/manage');
    await page.getByRole('button', { name: 'Add website', exact: true }).click();
    await page.locator('#name').fill(name);
    await page.locator('#url').fill(url);
    created = page.waitForResponse(r => r.url().endsWith('/user/websites') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create Website', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Website Created!' })).toBeVisible();
  }

  const response = await created;
  expect(response.status(), await response.text()).toBe(201);
  const websiteId = (await response.json()).data.website.id as string;
  const snippet = await page.locator('code').filter({ hasText: `data-website-id="${websiteId}"` }).innerText();
  expect(snippet).toContain(`data-website-id="${websiteId}"`);
  return { websiteId, snippet };
}
