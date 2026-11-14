import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';

async function capture() {
  const outDir = path.resolve('docs/screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  console.log('Navigating to http://localhost:4000 ...');
  await page.goto('http://localhost:4000', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise((r) => setTimeout(r, 2500));

  // 1. Board Tab
  await page.screenshot({ path: path.join(outDir, '1-board.png') });
  console.log('Captured 1-board.png');

  // 2. Team Tab
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((el) => el.textContent?.includes('My Team') || el.textContent?.includes('Team'));
    b?.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(outDir, '2-team-dashboard.png') });
  console.log('Captured 2-team-dashboard.png');

  // 3. Suggestions Tab
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((el) => el.textContent?.includes('Suggestions'));
    b?.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(outDir, '3-suggestions.png') });
  console.log('Captured 3-suggestions.png');

  // 4. Concurrency Simulator Modal
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((el) => el.textContent?.includes('Simulate Race') || el.textContent?.includes('50 Concurrent'));
    b?.click();
  });
  await new Promise((r) => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(outDir, '4-concurrency-sim.png') });
  console.log('Captured 4-concurrency-sim.png');

  // Close Concurrency modal
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 800));

  // 5. Scale & Telemetry Modal
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find((el) => el.textContent?.includes('TELEMETRY') || el.textContent?.includes('P95 LATENCY'));
    b?.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(outDir, '5-scale-telemetry.png') });
  console.log('Captured 5-scale-telemetry.png');

  await browser.close();
  console.log('All screenshots captured successfully!');
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
