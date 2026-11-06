import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, passphraseCriteria } from '../js/strength.js';
import { LEVEL1_SAMPLES } from '../js/levels/data.js';

const CASES = [
  ['123456', 'weak'],
  ['Barcelona2010', 'medium'],
  ['maria2009', 'weak'],
  ['T3cn0logia!', 'medium'],
  ['gat-taronja-pluja-47!', 'strong']
];

for (const [pw, expected] of CASES) {
  test(`${pw} → ${expected}`, () => {
    assert.equal(analyze(pw).level, expected);
  });
}

test('les respostes del nivell 1 coincideixen amb el comprovador', () => {
  for (const s of LEVEL1_SAMPLES) assert.equal(analyze(s.password).level, s.answer, s.password);
});

test('detecta patrons', () => {
  const ids = (pw) => analyze(pw).patterns.map((p) => p.id);
  assert.ok(ids('123456').includes('common'));
  assert.ok(ids('123456').includes('seq'));
  assert.ok(ids('maria2009').includes('year'));
  assert.ok(ids('maria2009').includes('dict'));
  assert.ok(ids('T3cn0logia!').includes('leet'));
  assert.ok(ids('gat-taronja-pluja-47!').includes('phrase'));
  assert.ok(ids('aaaa1111').includes('repeat'));
  assert.ok(ids('qwertyuiop').includes('seq'));
});

test('criteris del mètode de la frase', () => {
  assert.equal(passphraseCriteria('gat-taronja-pluja-47!').ok, true);
  assert.equal(passphraseCriteria('gat-taronja').ok, false);
  assert.equal(passphraseCriteria('gat taronja pluja').ok, false);
  assert.equal(passphraseCriteria('gos-mar-cel-7').ok, true);
  assert.equal(passphraseCriteria('').ok, false);
});
