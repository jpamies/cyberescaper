import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ZERO_HASH, canonicalize, createGenesis, appendBlock, verifyChain, sanitizeData,
  validateChainData, computeHash, sha256Hex, PrivacyError
} from '../js/chain.js';
import { deriveState, stateFingerprint } from '../js/derive.js';
import { buildExport, encodeCode, decodeCode, parseAny } from '../js/codec.js';

const GENESIS = {
  appVersion: '1.0.0', alias: 'FalconsBlaus', lang: 'ca', date: '2026-11-20',
  members: [
    { role: 'coordinador', specialty: 'passwords', avatar: '🦊' },
    { role: 'portaveu', specialty: 'phishing', avatar: '🐙', initial: 'A' },
    { role: 'tecnic', specialty: 'identity', avatar: '🦉' },
    { role: 'secretari', specialty: 'crypto', avatar: '🐺' }
  ]
};

async function sampleChain() {
  let c = await createGenesis(GENESIS, { timestamp: '2026-11-20T09:00:00.000Z' });
  c = await appendBlock(c, 'session_start', { session: 2 }, { timestamp: '2026-11-20T09:01:00.000Z' });
  c = await appendBlock(c, 'hint_used', { level: 0, hint: 1 }, { timestamp: '2026-11-20T09:10:00.000Z' });
  c = await appendBlock(c, 'level_completed', {
    level: 0, points: 10, hintsUsed: 1, attempts: 2, score: { found: 8, distractors: 1 },
    report: 'Hem trobat tots els errors i hem après a bloquejar la sessió.'
  }, { timestamp: '2026-11-20T09:30:00.000Z' });
  c = await appendBlock(c, 'session_pause', { session: 2, elapsedSec: 1740 }, { timestamp: '2026-11-20T09:30:00.000Z' });
  c = await appendBlock(c, 'session_start', { session: 3 }, { timestamp: '2026-11-27T09:00:00.000Z' });
  c = await appendBlock(c, 'level_completed', {
    level: 1, points: 20, hintsUsed: 0, attempts: 1,
    score: { classification: 5, passphraseOk: true, passphraseLength: 21 },
    report: 'Una frase de contrasenya llarga és millor que una paraula amb símbols.'
  }, { timestamp: '2026-11-27T09:20:00.000Z' });
  return c;
}

test('canonicalize: claus ordenades de forma recursiva i sense espais', () => {
  assert.equal(canonicalize({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: 'x' } }), '{"a":{"c":"x","d":[3,{"y":2,"z":1}]},"b":1}');
  assert.equal(canonicalize({ a: 1, b: 2 }), canonicalize({ b: 2, a: 1 }));
  assert.equal(canonicalize([1, 'a', true, null]), '[1,"a",true,null]');
  assert.equal(canonicalize({ a: undefined, b: 1 }), '{"b":1}');
  assert.equal(canonicalize({ t: 'l·l ç à' }), '{"t":"l·l ç à"}');
});

test('canonicalize: estable (mateixa entrada → mateix text, també amb claus barrejades)', () => {
  const x = { z: [1, 2, { b: 1, a: 2 }], m: { q: 1, p: { y: 1, x: 2 } } };
  const y = JSON.parse(JSON.stringify({ m: { p: { x: 2, y: 1 }, q: 1 }, z: [1, 2, { a: 2, b: 1 }] }));
  assert.equal(canonicalize(x), canonicalize(y));
  assert.equal(canonicalize(x), canonicalize(JSON.parse(canonicalize(x))));
});

test('sha256Hex coincideix amb un vector conegut', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('gènesi: índex 0, prevHash de 64 zeros i hash correcte', async () => {
  const [g] = await createGenesis(GENESIS);
  assert.equal(g.index, 0);
  assert.equal(g.type, 'genesis');
  assert.equal(g.prevHash, ZERO_HASH);
  assert.equal(g.prevHash.length, 64);
  const { hash, ...rest } = g;
  assert.equal(hash, await sha256Hex(ZERO_HASH + canonicalize(rest)));
  assert.equal(hash, await computeHash(g));
});

test('afegir blocs: enllaça amb el hash anterior i no modifica la cadena original', async () => {
  const c1 = await createGenesis(GENESIS);
  const c2 = await appendBlock(c1, 'session_start', { session: 2 });
  assert.equal(c1.length, 1);
  assert.equal(c2.length, 2);
  assert.equal(c2[1].index, 1);
  assert.equal(c2[1].prevHash, c1[0].hash);
});

test('verificar una cadena íntegra retorna -1', async () => {
  assert.equal(await verifyChain(await sampleChain()), -1);
});

test('detecta la manipulació de qualsevol camp a qualsevol índex', async () => {
  const chain = await sampleChain();
  const mutate = (v) => (typeof v === 'number' ? v + 1 : typeof v === 'boolean' ? !v : typeof v === 'string' ? v + 'x' : v);
  function paths(obj, prefix = []) {
    const out = [];
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === 'object') out.push(...paths(v, [...prefix, k]));
      else out.push([...prefix, k]);
    }
    return out;
  }
  let checked = 0;
  for (let i = 0; i < chain.length; i++) {
    for (const p of paths(chain[i])) {
      if (p[0] === 'hash') continue;
      const copy = structuredClone(chain);
      let o = copy[i];
      for (const k of p.slice(0, -1)) o = o[k];
      o[p.at(-1)] = mutate(o[p.at(-1)]);
      assert.equal(await verifyChain(copy), i, `bloc ${i}, camp ${p.join('.')}`);
      checked++;
    }
    // també si se n'altera el hash
    const copy = structuredClone(chain);
    copy[i].hash = copy[i].hash.replace(/^./, (c) => (c === 'a' ? 'b' : 'a'));
    assert.equal(await verifyChain(copy), i);
  }
  assert.ok(checked > 30);
});

test('detecta blocs eliminats, reordenats o afegits', async () => {
  const chain = await sampleChain();
  assert.equal(await verifyChain(chain.filter((_, i) => i !== 2)), 2);
  const swapped = [...chain];
  [swapped[3], swapped[4]] = [swapped[4], swapped[3]];
  assert.equal(await verifyChain(swapped), 3);
  assert.equal(await verifyChain([]), 0);
});

test('límit de privadesa: rebutja camps no permesos i retalla l\'informe a 500 caràcters', async () => {
  assert.throws(() => sanitizeData('genesis', { ...GENESIS, name: 'Maria' }), PrivacyError);
  assert.throws(() => sanitizeData('genesis', { ...GENESIS, members: [{ role: 'x', specialty: 'y', name: 'Joan' }] }), PrivacyError);
  assert.throws(() => sanitizeData('level_completed', { level: 1, score: { password: 'secret' } }), PrivacyError);
  assert.throws(() => sanitizeData('hint_used', { level: 1, hint: 1, extra: true }), PrivacyError);
  assert.throws(() => sanitizeData('unknown', {}), PrivacyError);
  assert.throws(() => sanitizeData('genesis', { ...GENESIS, alias: 'amb espais' }), PrivacyError);
  const long = 'a'.repeat(800);
  assert.equal(sanitizeData('level_completed', { level: 0, report: long }).report.length, 500);
  const c = await appendBlock(await createGenesis(GENESIS), 'level_completed', { level: 0, points: 10, report: long });
  assert.equal(c[1].data.report.length, 500);
  await assert.rejects(appendBlock(c, 'level_completed', { level: 1, passphrase: 'gat-taronja' }), PrivacyError);
});

test('validateChainData detecta dades no permeses fins i tot si el hash quadra', async () => {
  const chain = await sampleChain();
  assert.equal(validateChainData(chain), -1);
  const bad = structuredClone(chain);
  bad[2].data.secret = 'x';
  bad[2].hash = await computeHash(bad[2]);
  assert.equal(validateChainData(bad), 2);
});

test('estat derivat només dels blocs i reproduïble després d\'exportar/importar', async () => {
  const chain = await sampleChain();
  const st = deriveState(chain, Date.parse('2026-11-27T09:30:00.000Z'));
  assert.equal(st.currentLevel, 2);
  assert.equal(st.points, 10 + 20 - 2);
  assert.deepEqual(st.badges, ['access', 'passwords']);
  assert.deepEqual(st.noHintLevels, [1]);
  assert.equal(st.sessions[2].elapsedSec, 1740);
  assert.equal(st.activeSession, 3);
  assert.equal(st.hintsBySession[2], 1);

  const exp = buildExport(chain, { now: new Date('2026-11-27T09:30:00.000Z') });
  const code = await encodeCode(exp);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  const back = await decodeCode(code.replace(/(.{40})/g, '$1\n'));
  assert.deepEqual(back, JSON.parse(JSON.stringify(exp)));
  const parsed = await parseAny(JSON.stringify(exp));
  assert.equal(parsed.source, 'json');
  assert.equal(await verifyChain(parsed.chain), -1);
  const st2 = deriveState(parsed.chain, Date.parse('2026-11-27T09:30:00.000Z'));
  assert.equal(stateFingerprint(st2), stateFingerprint(st));
  // afegir el bloc d'importació no canvia l'estat del joc
  const withImport = await appendBlock(parsed.chain, 'import', { source: 'json', blocks: parsed.chain.length });
  assert.equal(stateFingerprint(deriveState(withImport)), stateFingerprint(st2));
});

test('pròrroga i pistes resten punts', async () => {
  let c = await sampleChain();
  c = await appendBlock(c, 'overtime', { session: 3, penalty: 5 });
  c = await appendBlock(c, 'hint_used', { level: 2, hint: 1 });
  const st = deriveState(c);
  assert.equal(st.points, 30 - 2 - 2 - 5);
  assert.equal(st.overtime[3], 5);
});
