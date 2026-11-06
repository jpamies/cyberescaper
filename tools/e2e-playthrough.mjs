// Prova de punta a punta (opcional, NO s'executa a la CI perquè necessita Playwright).
// Ús: python3 -m http.server 8765  (en una altra terminal)
//     node tools/e2e-playthrough.mjs http://localhost:8765/ ./e2e-out
// Juga tots els nivells, canvia d'idioma a mig camí, descarrega JSON i PDF, esborra
// localStorage, importa el JSON i comprova la pàgina docent. Falla si hi ha errors a la
// consola o peticions a dominis externs.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MESSAGES, realClues } from '../js/levels/level2-data.js';
import { LEVEL3_ITEMS, LEVEL3_STEPS } from '../js/levels/data.js';
import { totp } from '../js/totp.js';
import { encrypt } from '../js/caesar.js';

const { chromium } = createRequire(import.meta.url)('playwright'); // resol també amb NODE_PATH

const BASE = process.argv[2] || 'http://localhost:8765/';
const OUT = process.argv[3] || './e2e-out';
mkdirSync(OUT, { recursive: true });
const PASS = 'llapis-lluna-cami-93!';
const origin = new URL(BASE).origin;

const errors = [];
const external = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true, deviceScaleFactor: Number(process.env.DSF || 1) });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('request', (r) => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
page.on('dialog', (d) => { errors.push('native dialog used: ' + d.type()); d.dismiss(); });

const step = (s) => console.log('→', s);
const confirmDialog = async () => { await page.locator('dialog[open] .dialog-actions button').last().click(); };
const report = (txt) => page.fill('textarea[id^="report-"]', txt);
const openLock = async () => { await page.click('.btn-lock'); };
const expectSuccess = async (n) => { await page.waitForSelector('.success-card', { timeout: 8000 }); step(`nivell ${n} superat`); };

await page.goto(BASE);
await page.waitForSelector('.red-alert');
await page.screenshot({ path: join(OUT, '01-portada.png'), fullPage: true });

step('registre');
await page.click('a.btn-primary.btn-big');
await page.waitForSelector('#alias');
await page.fill('#alias', 'x y');
await page.click('form button[type=submit]');
await page.waitForSelector('.errors li');
await page.fill('#alias', 'FalconsBlaus');
await page.click('form button[type=submit]');
await page.waitForSelector('.levels');

step('sessió 2');
await page.click('.timer-panel .btn >> nth=0');
await page.waitForTimeout(300);

// ---------- Nivell 0 ----------
await page.click('a[href="#/nivell/0"]');
await page.waitForSelector('.scene');
for (const z of ['postit', 'session', 'usb', 'email', 'wifi', 'antivirus', 'update', 'file', 'plant']) await page.click(`.zone[data-zone="${z}"]`);
await page.fill('#l0-answer', '7');
await report('Hem revisat tot l\'escriptori del col·legi i hem trobat els errors de seguretat.');
await openLock();
await page.waitForSelector('.lock-status.closed');
step('ús de pista');
await page.click('.hint-btn >> nth=0');
await confirmDialog();
await page.waitForSelector('.hint-card.open');
await page.screenshot({ path: join(OUT, '02-nivell0.png'), fullPage: true });
await page.fill('#l0-answer', '8');
await openLock();
await expectSuccess(0);
await page.screenshot({ path: join(OUT, '03-nivell0-superat.png') });

step('pausa i sessió 3');
await page.goto(BASE + '#/mapa');
await page.waitForSelector('.timer-panel');
await page.click('.timer-panel .btn >> nth=1');
await page.waitForTimeout(300);

// ---------- Nivell 1 ----------
await page.goto(BASE + '#/nivell/1');
await page.waitForSelector('.classify');
const answers = { p1: 'weak', p2: 'medium', p3: 'weak', p4: 'medium', p5: 'strong' };
for (const [id, v] of Object.entries(answers)) await page.check(`#l1-${id}-${v}`);
await page.fill('#l1-tester', 'Barcelona2010');
await page.fill('#l1-pass', PASS);
await report(`Una frase llarga amb paraules sense relació és més segura. ${PASS}`);
await openLock();
await page.waitForSelector('.lock-status.closed');
await report('Una frase llarga amb paraules sense relació és més segura que una paraula amb símbols.');
await openLock();
await expectSuccess(1);

step('canvi d\'idioma a castellà');
await page.selectOption('#lang-select', 'es');
await page.waitForFunction(() => document.documentElement.lang === 'es');

// ---------- Nivell 2 ----------
await page.goto(BASE + '#/nivell/2');
await page.waitForSelector('.phone');
for (const msg of MESSAGES) {
  await page.click(`#tab-${msg.channel}`);
  const card = page.locator(`article[data-msg="${msg.id}"]`);
  await card.waitFor();
  if (msg.id === 1) {
    await card.locator('.fake-link').first().hover();
    await card.locator('.fake-link').first().click();
    await page.waitForSelector('dialog[open]');
    await confirmDialog();
  }
  await card.locator('.verdict-btn').nth(msg.fraud ? 0 : 1).click();
  if (msg.fraud) {
    for (const c of realClues(msg)) {
      if (c.key === 'sender') { await card.locator('.sender-btn').click(); await card.locator('.sender-detail .flag-btn').click(); }
      else if (c.kind === 'link') await card.locator(`.flag-btn[data-key="${c.key}"]`).click();
      else await card.locator(`.seg[data-key="${c.key}"]`).click();
    }
    await card.locator(`input[id="m${msg.id}-noClick"]`).check();
    await card.locator(`input[id="m${msg.id}-verify"]`).check();
  }
  await card.locator('.btn-primary', { hasText: /Revisar/ }).click();
}
await page.click('#tab-whatsapp');
await page.screenshot({ path: join(OUT, '04-nivell2.png'), fullPage: true });
await report('Hemos aprendido que hay que mirar quién envía el mensaje y qué nos pide antes de responder.');
await openLock();
await expectSuccess(2);

step('sessió 4 (tornem a català)');
await page.selectOption('#lang-select', 'ca');
await page.waitForFunction(() => document.documentElement.lang === 'ca');
await page.goto(BASE + '#/mapa');
await page.waitForSelector('.timer-panel');
await page.click('.timer-panel .btn >> nth=2');
await page.waitForTimeout(300);

// ---------- Nivell 3 ----------
await page.goto(BASE + '#/nivell/3');
await page.waitForSelector('.profile');
for (const it of LEVEL3_ITEMS) {
  await page.click(`[data-item="${it.id}"]`);
  if (it.risk) await page.selectOption(`#l3-m-${it.id}`, it.ok[0]);
}
for (let i = 0; i < LEVEL3_STEPS.length; i++) {
  for (;;) {
    const order = await page.$$eval('.order-item', (els) => els.map((e) => e.dataset.id));
    const at = order.indexOf(LEVEL3_STEPS[i]);
    if (at === i) break;
    await page.click(`.order-item[data-id="${LEVEL3_STEPS[i]}"] .up`);
  }
}
await page.click('text=Comprovar l\'ordre');
await page.waitForSelector('#l3-code');
await page.fill('#l3-code', await totp());
await page.click('text=Verificar');
await page.waitForSelector('#l3-saved');
await page.check('#l3-saved');
await page.screenshot({ path: join(OUT, '05-nivell3.png'), fullPage: true });
await report('Hem amagat les dades personals i hem activat la verificació en dos passos.');
await openLock();
await expectSuccess(3);

// ---------- Nivell 4 ----------
await page.goto(BASE + '#/nivell/4');
await page.waitForSelector('.wheel');
await page.focus('.wheel');
for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
const plain = 'EL SERVIDOR ES POT RECUPERAR AMB LA CLAU BLAVA';
await page.fill('#l4-a', plain.toLowerCase());
await page.click('#l4a-h >> xpath=.. >> text=Comprovar');
await page.fill('#l4-b', encrypt('EQUIP BLAU PREPARAT', 8));
await page.click('#l4b-h >> xpath=.. >> text=Comprovar');
await page.click('text=Fer una còpia per experimentar');
const editable = page.locator('.block-edit input[type=number]').first();
await editable.fill('99');
await editable.dispatchEvent('change');
await page.click('text=Verificar la còpia');
await page.waitForSelector('.block.broken');
await page.check('#l4-q-a');
await page.click('#l4c-h >> xpath=.. >> .btn-row >> nth=1 >> text=Comprovar');
await page.screenshot({ path: join(OUT, '06-nivell4.png'), fullPage: true });
await report('El xifratge protegeix la confidencialitat i el hash protegeix la integritat.');
await openLock();
await expectSuccess(4);

// ---------- Final ----------
await page.click('a[href="#/final"]');
await page.waitForSelector('.restored');
await page.screenshot({ path: join(OUT, '07-final.png'), fullPage: true });

step('recàrrega: es manté el progrés');
const fpBefore = await page.evaluate(async () => {
  const { deriveState, stateFingerprint } = await import('./js/derive.js');
  return stateFingerprint(deriveState(JSON.parse(localStorage.getItem('cyberescaper:v1:chain'))));
});
await page.reload();
await page.waitForSelector('.restored');

step('descàrregues');
const [dlJson] = await Promise.all([page.waitForEvent('download'), page.click('text=Descarregar el JSON')]);
const jsonPath = join(OUT, dlJson.suggestedFilename());
await dlJson.saveAs(jsonPath);
const [dlPdf] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('text=Descarregar l\'informe (PDF)')]);
const pdfPath = join(OUT, dlPdf.suggestedFilename());
await dlPdf.saveAs(pdfPath);

step('la contrasenya no apareix enlloc');
const ls = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
const jsonText = readFileSync(jsonPath, 'utf8');
if (ls.includes(PASS) || jsonText.includes(PASS) || readFileSync(pdfPath).includes(PASS)) errors.push('passphrase leaked');

step('esborrar localStorage i importar');
await page.evaluate(() => localStorage.clear());
await page.goto(BASE + '#/equip');
await page.reload();
await page.waitForSelector('#import-file');
await page.setInputFiles('#import-file', jsonPath);
await page.waitForSelector('.levels', { timeout: 8000 });
const fpAfter = await page.evaluate(async () => {
  const { deriveState, stateFingerprint } = await import('./js/derive.js');
  return stateFingerprint(deriveState(JSON.parse(localStorage.getItem('cyberescaper:v1:chain'))));
});
if (fpAfter !== fpBefore) errors.push('import state mismatch\n' + fpBefore + '\n' + fpAfter);
await page.screenshot({ path: join(OUT, '08-mapa-importat.png'), fullPage: true });

step('alt contrast i lletra gran');
await page.click('.a11y-menu summary');
await page.click('#toggle-contrast');
await page.click('.a11y-menu summary').catch(() => {});
await page.evaluate(() => document.querySelector('.a11y-menu').open = true);
await page.click('.seg-group .btn >> nth=2');
await page.goto(BASE + '#/glossari');
await page.waitForSelector('.glossary');
await page.screenshot({ path: join(OUT, '09-glossari-contrast.png'), fullPage: true });

step('pàgina docent');
const tampered = JSON.parse(jsonText);
const lc = tampered.chain.find((b) => b.type === 'level_completed');
lc.data.points += 5;
const tPath = join(OUT, 'tampered.json');
writeFileSync(tPath, JSON.stringify(tampered));
await page.goto(BASE + 'docente.html');
await page.waitForSelector('#files');
await page.setInputFiles('#files', [jsonPath, tPath]);
await page.waitForSelector('article.card h3');
const texts = await page.$$eval('article.card .feedback', (els) => els.map((e) => e.textContent));
console.log('docent:', texts);
if (!texts[0]?.includes('Íntegra') || !texts[1]?.includes(`bloc ${lc.index}`)) errors.push('teacher verifier wrong: ' + texts.join(' | '));
await page.screenshot({ path: join(OUT, '10-docent.png'), fullPage: true });
const [dlCsv] = await Promise.all([page.waitForEvent('download'), page.click('text=Exportar el resum en CSV')]);
await dlCsv.saveAs(join(OUT, 'resum.csv'));

await browser.close();
console.log('\nPDF:', pdfPath);
console.log('external requests:', external.length ? external : 'cap');
console.log('errors:', errors.length ? errors : 'cap');
process.exit(errors.length || external.length ? 1 : 0);
