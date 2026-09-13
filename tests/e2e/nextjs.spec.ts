import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('public pages render on the server with metadata, CSP nonces and real deep links', async ({
  request,
  browser,
}) => {
  const article = await request.get('/forests/corbett');
  expect(article.status()).toBe(200);
  const html = await article.text();
  expect(html).toContain('Corbett National Park');
  expect(html).toContain('<title>Corbett National Park | Crawlers</title>');
  expect(html).toContain('/_next/');
  expect(html).not.toContain('/@vite');
  const csp = article.headers()['content-security-policy'];
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  expect(html).toContain(`nonce="${nonce}"`);
  expect(csp).not.toContain('unsafe-eval');
  expect((await request.get('/forests')).headers()['content-security-policy']).not.toBe(csp);
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('/forests/corbett');
    await expect(
      page.getByRole('heading', { name: 'Corbett National Park', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.article-layout section')).not.toHaveCount(0);
  } finally {
    await context.close();
  }
  expect((await request.get('/does-not-exist')).status()).toBe(404);
  expect((await request.get('/Gallary/Gallary.html', { maxRedirects: 0 })).status()).toBe(308);
});

test('gallery search, viewer, keyboard dismissal and Next navigation work without hydration errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/gallery');
  await expect(page.getByRole('heading', { name: 'Nature gallery' })).toBeVisible();
  await expect(page.locator('.gallery-card')).toHaveCount(84);
  const title = await page.locator('.gallery-card > span').first().innerText();
  await page.getByLabel('Search photographs').fill(title);
  expect(await page.locator('.gallery-card').count()).toBeLessThan(84);
  await page.locator('.gallery-card').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.map((item) => item.id)).toEqual([]);
  await page.screenshot({ path: 'test-results/gallery-desktop.png', fullPage: true });
  // A marker survives client navigation; a full document reload would discard it.
  await page.evaluate(() => {
    document.documentElement.dataset.navigationMarker = 'preserved';
  });
  await page.getByRole('link', { name: 'Forest atlas', exact: true }).click();
  await expect(page).toHaveURL(/\/forests$/);
  await expect(page.locator('html')).toHaveAttribute('data-navigation-marker', 'preserved');
  await page.getByLabel('Search forests').fill('Corbett');
  await page.locator('.forest-card').click();
  await expect(page).toHaveURL(/\/forests\/corbett$/);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Corbett National Park', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('Next API method boundaries, authentication, data isolation and SSE use the real server', async ({
  request,
  page,
}) => {
  expect((await request.get('/api/health')).status()).toBe(200);
  expect((await request.get('/api/jobs')).status()).toBe(401);
  expect((await request.patch('/api/jobs')).status()).toBe(405);
  for (const path of [
    '/data/crawlers.sqlite',
    '/.env',
    '/server/config.ts',
    '/legacy/%2e%2e%2f.env',
  ]) {
    expect((await request.get(path)).status()).not.toBe(200);
  }
  expect((await request.get('/legacy/index.html')).status()).toBe(200);
  await page.goto('/jobs');
  await page.getByLabel('Workspace key').fill('e2e-fixture-key-only-never-for-production');
  await page.getByRole('button', { name: 'Unlock workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Crawl jobs', exact: true })).toBeVisible();
  const update = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const stream = new EventSource('/api/events');
        const timer = setTimeout(() => {
          stream.close();
          reject(new Error('SSE timed out'));
        }, 5000);
        stream.addEventListener('update', (event) => {
          clearTimeout(timer);
          stream.close();
          resolve((event as MessageEvent).data);
        });
      }),
  );
  expect(JSON.parse(update).at).toBeTruthy();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Crawl jobs', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByLabel('Workspace key')).toBeVisible();
  expect((await page.request.get('/api/jobs')).status()).toBe(401);
});
