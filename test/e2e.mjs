// Drives the built app in Chromium: make a character, learn a cantrip, study
// Fireball to the final check, cast it. Run after `npm run build`:
//   node test/e2e.mjs            (SHOTS=dir to save screenshots)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

// Playwright comes from the machine (CI installs it), not from this app's packages.
const { chromium } = createRequire(import.meta.url)('playwright');

const port = 4179;
const srv = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
for (let i = 0; ; i++) {
  try { if ((await fetch(`http://localhost:${port}/`)).ok) break; } catch { /* not up yet */ }
  if (i > 100) throw new Error('vite preview did not start');
  await new Promise((r) => setTimeout(r, 200));
}
const shots = process.env.SHOTS;
const browser = await chromium.launch();
try {
  for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport: vp });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('dialog', (d) => d.accept());
    await page.goto(`http://localhost:${port}/`);
    // The first-launch popup, then gone for good.
    await page.getByRole('dialog', { name: 'Manaweave' }).waitFor();
    await page.getByRole('dialog').getByRole('button', { name: 'Start' }).click();
    await page.getByRole('button', { name: 'New character' }).click();
    await page.getByLabel('Name').fill('Mira');
    await page.getByLabel('Level').fill('5');
    await page.getByLabel('Score').fill('16');
    await page.getByLabel('Full').fill('5');
    await page.getByLabel('Spell to add').fill('Scorching Ray');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByLabel('Spell to add').fill('Shatter');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Tree' }).click();
    await page.getByRole('group', { name: 'Evocation' }).waitFor();
    // The helper answers from the plan's own numbers.
    await page.getByRole('button', { name: 'Ask', exact: true }).first().click();
    await page.getByLabel('Your question').fill('How long to learn Fireball?');
    await page.getByLabel('Helper').getByRole('button', { name: 'Ask', exact: true }).click();
    await page.getByText(/Fireball \(level 3\) for Mira: 13 study points/).waitFor();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    if (shots) await page.screenshot({ path: `${shots}/tree-${vp.width}.png`, fullPage: false });
    // Fireball can be learned: the study table is the plan's.
    // Find it by search (Enter opens it and brings it into view), check its node, then close and click the node itself.
    await page.getByLabel('Search spells').fill('Fireball');
    await page.getByLabel('Search spells').press('Enter');
    await page.getByRole('complementary', { name: 'Fireball details' }).getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: /^Fireball, Level 3, Can learn/ }).click();
    const panel = page.getByRole('complementary', { name: 'Fireball details' });
    await panel.getByRole('cell', { name: 'With a mentor' }).waitFor();
    const rows = await panel.locator('tbody tr').allInnerTexts();
    assert.deepEqual(rows.map((r) => r.replace(/\s+/g, ' ').trim()), ['Alone 13 250', 'With a text 7 250', 'With a mentor 5 500']);
    if (shots) await page.screenshot({ path: `${shots}/panel-${vp.width}.png` });
    await panel.getByRole('button', { name: 'Start learning' }).click();
    await panel.getByText('Studying started.').waitFor();
    await panel.getByLabel('Downtime days').fill('7');
    await panel.getByRole('button', { name: 'Log study days' }).click();
    await panel.getByLabel('d20 (empty: roll)').fill('15');
    await panel.getByRole('button', { name: 'Roll the final check' }).click();
    await panel.getByText(/Fireball is learned!/).waitFor();
    // Cast it from the character page.
    await page.getByRole('button', { name: 'Character' }).click();
    await page.getByRole('listitem').filter({ hasText: 'Fireball' }).getByRole('button', { name: 'Cast' }).click();
    await page.getByText('Cast Fireball for 5 mana.').waitFor();
    if (shots) await page.screenshot({ path: `${shots}/character-${vp.width}.png`, fullPage: true });
    const x = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(x <= 0, `no sideways scroll (${x}px)`);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('e2e ok');
} finally {
  await browser.close();
  srv.kill();
}
