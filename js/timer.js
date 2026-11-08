// Temporitzador de sessió: 30 minuts per sessió.
// - Per jugar els nivells d'una sessió cal ACTIVAR-LA (el rellotge comença a comptar).
// - Quan l'equip supera tots els nivells de la sessió, el rellotge s'atura i es posa en
//   verd amb el temps que ha sobrat (bloc session_pause amb completed: true).
// - Si arriba a zero no bloqueja res: entra en «pròrroga», resta 5 punts una sola vegada
//   i ho registra a la cadena.
import * as state from './state.js';
import { SESSION_SECONDS, OVERTIME_PENALTY, SESSIONS, canStartSession, sessionLevelsDone } from './derive.js';
import { t } from './i18n.js';
import { h, announce, fmtTime } from './ui.js';

let ticking = null;
const overtimePending = new Set();
const announced = new Set();
const views = new Set();

function readLastTick() {
  try { return Number(localStorage.getItem(state.LASTTICK_KEY)) || null; } catch { return null; }
}
function writeLastTick(v) {
  try { localStorage.setItem(state.LASTTICK_KEY, String(v)); } catch { /* res */ }
}

export function status() {
  const st = state.derivedNow();
  const s = st.activeSession;
  if (!s) return { session: null, st };
  const elapsed = st.sessions[s].elapsedSec;
  const remaining = SESSION_SECONDS - elapsed;
  return { session: s, remaining, overtime: remaining <= 0, st };
}

/** Temps sobrant (positiu) o de pròrroga (negatiu) d'una sessió. */
export function remainingOf(st, n) {
  return SESSION_SECONDS - st.sessions[n].elapsedSec;
}

/** Text «sobren 07:32» o «pròrroga +03:10». */
export function leftText(sec) {
  return sec >= 0 ? t('timer.left', { time: fmtTime(sec) }) : t('timer.over', { time: fmtTime(-sec) });
}

export async function startSession(n) {
  const st = state.derivedNow();
  if (st.activeSession === n || !canStartSession(st, n)) return;
  if (st.activeSession) await pause();
  await state.append('session_start', { session: n });
  writeLastTick(Date.now());
  tick();
}

async function stopClock({ auto = false, completed = false, at = Date.now() } = {}) {
  const cur = state.derivedNow();
  const s = cur.activeSession;
  if (!s) return null;
  const ses = cur.sessions[s];
  const elapsedSec = Math.round(ses.base + Math.max(0, (at - ses.startedAt) / 1000));
  const data = { session: s, elapsedSec };
  if (auto) data.auto = true;
  if (completed) data.completed = true;
  await state.append('session_pause', data);
  tick();
  return { session: s, remaining: SESSION_SECONDS - elapsedSec };
}

export function pause(opts = {}) {
  return stopClock(opts);
}

/**
 * Si l'equip ha superat tots els nivells de la sessió activa, atura el rellotge i la marca
 * com a completada. Retorna { session, remaining } o null.
 */
export async function completeIfDone() {
  const st = state.derivedNow();
  const s = st.activeSession;
  if (!s || !sessionLevelsDone(st, s)) return null;
  const res = await stopClock({ completed: true });
  if (res) announce(t('timer.sessionDoneMsg', { s: res.session, left: leftText(res.remaining) }), { assertive: true });
  return res;
}

/** Si l'app es va tancar amb el rellotge en marxa, el pausa en el moment de l'última activitat. */
export async function reconcile() {
  const cur = state.derivedNow();
  if (!cur.activeSession) return;
  const last = readLastTick();
  const now = Date.now();
  if (last && now - last > 120000) await stopClock({ auto: true, at: last });
}

async function tick() {
  const s = status();
  if (s.session) {
    writeLastTick(Date.now());
    const mins = Math.ceil(s.remaining / 60);
    for (const m of [10, 5]) {
      const key = `${s.session}:${m}`;
      if (mins === m && !announced.has(key)) { announced.add(key); announce(t('timer.minutesLeft', { n: m })); }
    }
    if (s.overtime && !(s.session in s.st.overtime) && !overtimePending.has(s.session)) {
      overtimePending.add(s.session);
      await state.append('overtime', { session: s.session, penalty: OVERTIME_PENALTY });
      announce(t('timer.overtimeStarted', { n: OVERTIME_PENALTY }), { assertive: true });
    }
  }
  for (const v of [...views]) {
    if (!v.isConnected) { views.delete(v); continue; }
    v._update(s);
  }
}

export function startTicking() {
  if (ticking) return;
  ticking = setInterval(tick, 1000);
  tick();
}

/** Última sessió començada (per mostrar-ne l'estat quan no n'hi ha cap en marxa). */
function lastStarted(st) {
  return [...SESSIONS].reverse().find((n) => st.sessions[n].started) ?? null;
}

/** Indicador compacte (capçalera): text + botó de pausa/represa. */
export function timerBadge() {
  const text = h('span', { class: 'timer-text' });
  const btn = h('button', { type: 'button', class: 'btn btn-small' });
  const box = h('div', { class: 'timer-badge', role: 'group', 'aria-label': t('timer.title') },
    h('span', { 'aria-hidden': 'true' }, '⏱ '), text, btn);
  box._update = (s) => {
    const st = s.st;
    if (!st.team) { box.hidden = true; return; }
    box.hidden = false;
    box.classList.remove('overtime', 'done');
    if (s.session) {
      box.classList.toggle('overtime', s.overtime);
      text.textContent = s.overtime
        ? t('timer.overtimeShort', { s: s.session, time: fmtTime(-s.remaining) })
        : t('timer.runningShort', { s: s.session, time: fmtTime(s.remaining) });
      btn.textContent = t('timer.pause');
      btn.onclick = () => pause();
      btn.hidden = false;
      return;
    }
    const last = lastStarted(st);
    if (last && st.sessions[last].completed) {
      box.classList.add('done');
      text.textContent = t('timer.completedShort', { s: last, left: leftText(remainingOf(st, last)) });
      btn.hidden = true;
    } else if (last) {
      text.textContent = t('timer.pausedShort', { s: last, time: fmtTime(Math.max(0, remainingOf(st, last))) });
      btn.textContent = t('timer.resume');
      btn.hidden = false;
      btn.onclick = () => startSession(last);
    } else {
      text.textContent = t('timer.notStarted');
      btn.hidden = true;
    }
  };
  views.add(box);
  box._update(status());
  return box;
}

/** Botó per iniciar/reprendre/pausar una sessió (mapa i pantalla d'accés del nivell). */
export function sessionButton(n, { onDone } = {}) {
  const b = h('button', { type: 'button', class: 'btn session-btn', dataset: { session: String(n) } });
  b.addEventListener('click', async () => {
    const st = state.derivedNow();
    if (st.activeSession === n) await pause();
    else await startSession(n);
    onDone?.();
  });
  b._update = (s) => {
    const st = s.st;
    const ses = st.sessions[n];
    const running = s.session === n;
    let label;
    let cls = 'btn session-btn';
    let disabled = false;
    if (ses.completed) {
      label = '✔ ' + t('timer.doneButton', { s: n, left: leftText(remainingOf(st, n)) });
      cls += ' btn-done';
      disabled = true;
    } else if (running) {
      label = '⏸ ' + t('timer.pauseSession', { s: n }) + ` (${fmtTime(Math.max(0, s.remaining))})`;
      cls += ' btn-primary';
    } else if (ses.started) {
      label = '▶ ' + t('timer.resumeSession', { s: n }) + ` (${fmtTime(Math.max(0, remainingOf(st, n)))})`;
      disabled = !canStartSession(st, n);
    } else {
      label = '▶ ' + t('timer.startSession', { s: n });
      disabled = !canStartSession(st, n);
    }
    if (b.textContent !== label) b.textContent = label;
    b.className = cls;
    b.disabled = disabled;
    b.title = !ses.completed && disabled ? t('timer.notYet', { p: n - 1 }) : '';
    b.setAttribute('aria-pressed', running ? 'true' : 'false');
  };
  views.add(b);
  b._update(status());
  return b;
}

/** Panell complet del mapa: botons «Iniciar sessió 2/3/4». */
export function timerPanel() {
  const info = h('p', { class: 'timer-big', 'aria-live': 'off' });
  const buttons = h('div', { class: 'btn-row' }, SESSIONS.map((n) => sessionButton(n)));
  const panel = h('section', { class: 'card timer-panel', 'aria-labelledby': 'timer-h' },
    h('h2', { id: 'timer-h' }, '⏱ ', t('timer.title')),
    info, buttons,
    h('p', { class: 'muted small' }, t('timer.explain', { min: SESSION_SECONDS / 60, n: OVERTIME_PENALTY }))
  );
  panel._update = (s) => {
    const st = s.st;
    info.classList.remove('overtime', 'done');
    if (s.session) {
      info.textContent = s.overtime ? t('timer.overtimeLong', { s: s.session, time: fmtTime(-s.remaining) }) : t('timer.runningLong', { s: s.session, time: fmtTime(s.remaining) });
      info.classList.toggle('overtime', s.overtime);
      return;
    }
    const last = lastStarted(st);
    if (last && st.sessions[last].completed) {
      info.textContent = '✔ ' + t('timer.completedLong', { s: last, left: leftText(remainingOf(st, last)) });
      info.classList.add('done');
    } else {
      info.textContent = t('timer.noneRunning');
    }
  };
  views.add(panel);
  panel._update(status());
  return panel;
}
