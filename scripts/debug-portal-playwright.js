const { chromium } = require('playwright');

async function main() {
  const target = process.argv[2] || 'https://portal.allenisd.org';

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();
  const redirects = [];

  page.on('response', (res) => {
    const req = res.request();
    const status = res.status();
    const isDoc = req.resourceType() === 'document';
    if (isDoc || status >= 300) {
      const headers = res.headers();
      redirects.push({
        status,
        method: req.method(),
        type: req.resourceType(),
        url: res.url(),
        location: headers['location'] || '',
        proxyUrl: headers['x-proxy-url'] || '',
      });
    }
  });

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      console.log('NAV', frame.url());
    }
  });

  page.on('console', (msg) => {
    console.log('CONSOLE', msg.type(), msg.text());
  });

  page.on('requestfailed', (req) => {
    const err = req.failure() ? req.failure().errorText : 'unknown';
    console.log('REQ_FAILED', req.resourceType(), req.url(), err);
  });

  const first = await page.goto(target, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });

  console.log('FIRST_STATUS', first ? first.status() : 'null');

  await page.waitForTimeout(12000);

  console.log('FINAL_URL', page.url());
  console.log('FINAL_TITLE', await page.title());

  console.log('---REDIRECT_DOC_FLOW---');
  for (const r of redirects.filter((r) => r.type === 'document')) {
    const loc = r.location ? ` -> location: ${r.location}` : '';
    const proxied = r.proxyUrl ? ` | x-proxy-url: ${r.proxyUrl}` : '';
    console.log(`${r.status} ${r.method} ${r.url}${loc}${proxied}`);
  }

  console.log('---KEY_RESOURCE_URLS---');
  const resourceUrls = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((r) => r.name)
  );
  resourceUrls
    .filter((u) => /redirectToLogin|AuthnEngine|rapididentity|\/login/i.test(u))
    .slice(0, 100)
    .forEach((u) => console.log(u));

  await browser.close();
}

main().catch((err) => {
  console.error('PLAYWRIGHT_ERROR', err);
  process.exit(1);
});
