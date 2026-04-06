const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 900 },
  });

  const page = await context.newPage();
  const interesting = [];

  page.on('request', (req) => {
    const url = req.url();
    if (/idp\/authn\/idauto|api\/rest\/v2\/authn|\/api\/proxy\?url=/i.test(url)) {
      interesting.push({ type: 'REQ', method: req.method(), url });
    }
  });

  page.on('response', (res) => {
    const url = res.url();
    if (/idp\/authn\/idauto|api\/rest\/v2\/authn|\/api\/proxy\?url=/i.test(url)) {
      interesting.push({ type: 'RES', status: res.status(), url });
    }
  });

  await page.goto('http://localhost:3000/api/proxy?url=https%3A%2F%2Fportal.allenisd.org', {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });

  await page.waitForTimeout(3000);

  const firstInput = page.locator('input').first();
  if (await firstInput.count()) {
    await firstInput.fill('314663');
    await firstInput.press('Enter');
    await page.waitForTimeout(5000);
  }

  console.log('FINAL_URL', page.url());
  for (const item of interesting) {
    if (item.type === 'REQ') {
      console.log('REQ', item.method, item.url);
    } else {
      console.log('RES', item.status, item.url);
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error('PLAYWRIGHT_ERROR', err);
  process.exit(1);
});
