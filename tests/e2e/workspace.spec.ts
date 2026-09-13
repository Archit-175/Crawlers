import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Workspace key').fill('e2e-fixture-key-only-never-for-production');
  await page.getByRole('button', { name: 'Unlock workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Workspace overview' })).toBeVisible();
});
test('authenticated workspace, guide, theme and accessibility', async ({ page }) => {
  await expect(page.getByText('Live updates', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await page.getByRole('button', { name: 'Workspace guide' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  ).toEqual([]);
  await page.screenshot({ path: 'test-results/workspace-desktop.png', fullPage: true });
});
test('create, monitor, inspect, search, paginate, export and delete a crawl', async ({ page }) => {
  await page.getByRole('button', { name: 'New crawl', exact: true }).click();
  await page.getByLabel('Starting URL').fill('https://research.example.org');
  await page.getByLabel('Crawl name').fill('Forest field research');
  await page.getByLabel('Page limit').fill('9');
  await page.getByRole('button', { name: 'Advanced configuration' }).click();
  await page.getByLabel('Request spacing').fill('200');
  await page.getByRole('button', { name: 'Start crawl', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Forest field research' })).toBeVisible();
  await expect(page.locator('.page-title .badge')).toHaveText('completed', { timeout: 20000 });
  await page.getByLabel('Search pages').fill('/a');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByLabel('Search pages').fill('');
  await page.getByRole('button', { name: 'Forest research', exact: false }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('tab', { name: 'Metadata' }).click();
  await expect(page.getByRole('heading', { name: 'Headings' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'JSON', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/crawl-.*\.json/);
  await page.screenshot({ path: 'test-results/crawl-results-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Delete crawl', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete crawl' }).click();
  await expect(page.getByRole('heading', { name: 'Crawl jobs', exact: true })).toBeVisible();
});
test('private URL rejection and accessible crawl form', async ({ page }) => {
  await page.getByRole('button', { name: 'New crawl', exact: true }).click();
  await page.getByLabel('Starting URL').fill('http://127.0.0.1');
  await page.getByRole('button', { name: 'Start crawl', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(/private|internal/);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  ).toEqual([]);
});
test('forest atlas preserves searchable articles and quiz completion', async ({ page }) => {
  await page.getByRole('link', { name: 'Forest atlas', exact: true }).click();
  await page.getByLabel('Search forests').fill('Corbett');
  await expect(page.locator('.forest-card')).toHaveCount(1);
  await page.locator('.forest-card').click();
  await expect(
    page.getByRole('heading', { name: 'Corbett National Park', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.article-layout section')).not.toHaveCount(0);
  await page.getByRole('link', { name: 'Knowledge quiz' }).click();
  await page.getByRole('button', { name: 'Let’s find out' }).click();
  const questions = (await (await page.request.get('/api/library')).json()).questions as {
    answer: string;
  }[];
  for (let i = 0; i < questions.length; i++) {
    await page.getByRole('button', { name: questions[i].answer, exact: true }).click();
    await page
      .getByRole('button', { name: i === questions.length - 1 ? 'See results' : 'Next question' })
      .click();
  }
  await expect(page.getByRole('heading', { name: '8 / 8', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Question 1 of 8')).toBeVisible();
});
test('responsive mobile navigation, no page overflow, dark screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Workspace overview' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Forest atlas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Forest atlas' })).toBeVisible();
  await page.getByLabel('Search forests').fill('Corbett');
  await expect(page.locator('.forest-card')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.screenshot({ path: 'test-results/workspace-mobile.png', fullPage: true });
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  ).toEqual([]);
});
