import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MESSAGES, CHANNELS, allLinks, realClues, MIN_CLUES } from '../js/levels/level2-data.js';

const RESERVED_TLDS = ['example', 'invalid', 'test'];

test('hi ha 8 missatges', () => {
  assert.equal(MESSAGES.length, 8);
  assert.deepEqual(MESSAGES.map((m) => m.id), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('2 missatges per canal als 4 canals', () => {
  assert.deepEqual(CHANNELS, ['email', 'sms', 'whatsapp', 'instagram']);
  for (const ch of CHANNELS) assert.equal(MESSAGES.filter((m) => m.channel === ch).length, 2, ch);
});

test('5 fraudulents i 3 legítims', () => {
  assert.equal(MESSAGES.filter((m) => m.fraud).length, 5);
  assert.equal(MESSAGES.filter((m) => !m.fraud).length, 3);
});

test('cada frau té almenys 2 indicis marcables; els legítims, cap', () => {
  for (const m of MESSAGES) {
    if (m.fraud) assert.ok(realClues(m).length >= MIN_CLUES, `missatge ${m.id}`);
    else assert.equal(realClues(m).length, 0, `missatge ${m.id}`);
  }
});

test('cap enllaç apunta a un domini real (només TLD reservats)', () => {
  const links = allLinks();
  assert.ok(links.length >= 3);
  for (const { url, label } of links) {
    const host = new URL(url).hostname;
    const tld = host.split('.').at(-1);
    assert.ok(RESERVED_TLDS.includes(tld), `${url} no fa servir un TLD reservat`);
    if (label) assert.ok(url.includes(label.split('/')[0]), `l'etiqueta ${label} ha de coincidir amb l'URL real`);
  }
});

test('el codi del nivell 2 no crea cap <a href> real', () => {
  const src = readFileSync(new URL('../js/levels/level2.js', import.meta.url), 'utf8');
  assert.ok(!/h\('a'/.test(src), 'el nivell 2 no ha de fer servir elements <a>');
  assert.ok(!/href/.test(src), 'el nivell 2 no ha de tenir href');
});
