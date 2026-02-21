const { chromium } = require('playwright');
const { startServer } = require('../server');

(async () => {
  const { server, port } = await startServer(0, '127.0.0.1');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 2200 } });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle' });
  await page.screenshot({
    path: '/Users/jamesjoly/Documents/New project/output/bdc-ui.png',
    fullPage: true
  });
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  console.log('/Users/jamesjoly/Documents/New project/output/bdc-ui.png');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
