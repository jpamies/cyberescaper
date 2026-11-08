import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGenesis, appendBlock } from '../js/chain.js';
import { deriveState, levelAccess, canStartSession, sessionLevelsDone, SESSION_SECONDS } from '../js/derive.js';

const GENESIS = {
  appVersion: '1.0.0', alias: 'Equip1', lang: 'ca', date: '2026-11-20',
  members: [{ role: 'coordinador', specialty: 'passwords' }, { role: 'portaveu', specialty: 'phishing' },
    { role: 'tecnic', specialty: 'identity' }, { role: 'secretari', specialty: 'crypto' }]
};
const done = (level, points) => ['level_completed', { level, points, hintsUsed: 0, attempts: 1, score: {}, report: 'x'.repeat(40) }];

async function build(events) {
  let c = await createGenesis(GENESIS, { timestamp: '2026-11-20T09:00:00.000Z' });
  for (const [type, data, ts] of events) c = await appendBlock(c, type, data, ts ? { timestamp: ts } : {});
  return c;
}

test('cada sessió dura 30 minuts', () => {
  assert.equal(SESSION_SECONDS, 30 * 60);
});

test('sense sessió activa no es pot jugar cap nivell', async () => {
  const st = deriveState(await build([]));
  assert.deepEqual(levelAccess(st, 0), { ok: false, reason: 'noSession', session: 2 });
  assert.equal(levelAccess(st, 1).reason, 'locked');
});

test('amb la sessió activa es pot jugar; no es poden avançar nivells de sessions posteriors', async () => {
  const st = deriveState(await build([
    ['session_start', { session: 2 }], done(0, 10),
    ['session_pause', { session: 2, elapsedSec: 600, completed: true }],
    ['session_start', { session: 3 }], done(1, 20), done(2, 20)
  ]));
  assert.equal(levelAccess(st, 3).reason, 'laterSession');
  assert.equal(levelAccess(st, 3).session, 4);
  assert.ok(levelAccess(st, 0).ok, 'un nivell superat sempre es pot revisar');
});

test('un equip endarrerit pot recuperar nivells en una sessió posterior', async () => {
  const st = deriveState(await build([
    ['session_start', { session: 2 }], ['session_pause', { session: 2, elapsedSec: 1800 }],
    ['session_start', { session: 3 }]
  ]));
  assert.ok(levelAccess(st, 0).ok);
  assert.equal(st.sessions[2].completed, false);
});

test('les sessions s\'inicien en ordre i una sessió completada no es pot reprendre', async () => {
  let st = deriveState(await build([]));
  assert.ok(canStartSession(st, 2));
  assert.ok(!canStartSession(st, 3));
  st = deriveState(await build([
    ['session_start', { session: 2 }], done(0, 10), ['session_pause', { session: 2, elapsedSec: 700, completed: true }]
  ]));
  assert.ok(sessionLevelsDone(st, 2));
  assert.ok(!sessionLevelsDone(st, 3));
  assert.ok(st.sessions[2].completed);
  assert.equal(st.sessions[2].elapsedSec, 700);
  assert.ok(!canStartSession(st, 2));
  assert.ok(canStartSession(st, 3));
  assert.ok(!canStartSession(st, 4));
});

test('el temps de la sessió compta mentre està activa i s\'atura en pausa', async () => {
  const c = await build([
    ['session_start', { session: 2 }, '2026-11-20T09:00:00.000Z'],
    ['session_pause', { session: 2, elapsedSec: 300 }, '2026-11-20T09:05:00.000Z'],
    ['session_start', { session: 2 }, '2026-11-20T09:10:00.000Z']
  ]);
  const st = deriveState(c, Date.parse('2026-11-20T09:12:00.000Z'));
  assert.equal(st.activeSession, 2);
  assert.equal(st.sessions[2].elapsedSec, 420);
});
