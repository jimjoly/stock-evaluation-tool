const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const root = '/Users/jamesjoly/Documents/New project/public';
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

  const bodyMatch = indexHtml.match(/<body>([\s\S]*)<script src="\/app\.js"><\/script>[\s\S]*<\/body>/i);
  if (!bodyMatch) throw new Error('Failed to extract body from index.html');

  const html = `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>${css}</style></head><body>${bodyMatch[1]}<script>${js}<\/script></body></html>`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 2200 } });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const outPath = '/Users/jamesjoly/Documents/New project/output/bdc-ui.png';
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
  console.log(outPath);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
