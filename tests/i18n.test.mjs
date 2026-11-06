import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'i18n');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

function flatten(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') out.push(...flatten(v, key));
    else out.push(key);
  }
  return out;
}

const dicts = Object.fromEntries(files.map((f) => [f, JSON.parse(readFileSync(join(dir, f), 'utf8'))]));

test('hi ha almenys ca.json i es.json', () => {
  assert.ok(files.includes('ca.json'));
  assert.ok(files.includes('es.json'));
});

test('tots els fitxers d\'i18n tenen exactament les mateixes claus', () => {
  const ref = new Set(flatten(dicts['ca.json']));
  for (const f of files) {
    const keys = new Set(flatten(dicts[f]));
    const missing = [...ref].filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !ref.has(k));
    assert.deepEqual(missing, [], `${f}: falten claus`);
    assert.deepEqual(extra, [], `${f}: claus de més`);
  }
});

test('cap text buit', () => {
  for (const f of files) {
    for (const k of flatten(dicts[f])) {
      const v = k.split('.').reduce((o, p) => o[p], dicts[f]);
      assert.ok(typeof v === 'string' && v.length > 0, `${f}: ${k}`);
    }
  }
});

test('els paràmetres {x} coincideixen entre idiomes', () => {
  const params = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const k of flatten(dicts['ca.json'])) {
    const get = (d) => k.split('.').reduce((o, p) => o[p], d);
    for (const f of files) assert.equal(params(get(dicts[f])), params(get(dicts['ca.json'])), `${f}: ${k}`);
  }
});

test('la llista d\'idiomes de js/i18n.js correspon als fitxers', () => {
  const src = readFileSync(join(root, 'js/i18n.js'), 'utf8');
  const block = src.slice(src.indexOf('export const LANGS'), src.indexOf('];'));
  const codes = [...block.matchAll(/^\s*\{ code: '(\w+)'/gm)].map((m) => m[1]);
  assert.deepEqual(codes.map((c) => `${c}.json`).sort(), files.sort());
});

test('totes les claus estàtiques que fa servir el codi existeixen', () => {
  const keys = new Set(flatten(dicts['ca.json']));
  const objKeys = new Set();
  // també valen claus que apunten a objectes o llistes (p. ex. teacher.usage)
  for (const k of keys) { const parts = k.split('.'); for (let i = 1; i < parts.length; i++) objKeys.add(parts.slice(0, i).join('.')); }
  const jsFiles = [];
  const walk = (d) => readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.js') && jsFiles.push(join(d, e.name))));
  walk(join(root, 'js'));
  const missing = [];
  for (const f of jsFiles) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) if (!keys.has(m[1]) && !objKeys.has(m[1])) missing.push(`${f}: ${m[1]}`);
  }
  assert.deepEqual(missing, []);
});
