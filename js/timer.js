// Compte enrere narratiu de 50 minuts per sessió. Quan arriba a zero no bloqueja
// res: entra en «pròrroga», resta 5 punts una sola vegada i ho registra a la cadena.
import * as state from './state.js';
import { SESSION_SECONDS, OVERTIME_PENALTY } from './derive.js';
import { t } from './i18n.js';
import { h, clear, announce, fmtTime } from './ui.js';

let ticking = null;
let overtimePending = new Set();
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

export async function startSession(n) {
  const st = state.derivedNow();
  if (st.activeSession === n) return;
  if (st.activeSession) await pause();
  await state.append('session_start', { session: n });
  writeLastTick(Date.now());
}

export async function pause({ auto = false, at = Date.now() } = {}) {
  const cur = state.derivedNow();
  const s = cur.activeSession;
  if (!s) return;
  const ses = cur.sessions[s];
  const elapsedSec = Math.round(ses.base + Math.max(0, (at - ses.startedAt) / 1000));
  await state.append('session_pause', auto ? { session: s, elapsedSec, auto: true } : { session: s, elapsedSec });
}

/** Si l'app es va tancar amb el rellotge en marxa, el pausa en el moment de l'última activitat. */
export async function reconcile() {
  const cur = state.derivedNow();
  if (!cur.activeSession) return;
  const last = readLastTick();
  const now = Date.now();
  if (last && now - last > 120000) await pause({ auto: true, at: last });
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
    if (s.session) {
      box.classList.toggle('overtime', s.overtime);
      text.textContent = s.overtime
        ? t('timer.overtimeShort', { s: s.session, time: fmtTime(-s.remaining) })
        : t('timer.runningShort', { s: s.session, time: fmtTime(s.remaining) });
      btn.textContent = t('timer.pause');
      btn.onclick = () => pause().then(tick);
      btn.hidden = false;
    } else {
      box.classList.remove('overtime');
      const last = [4, 3, 2].find((n) => st.sessions[n].started);
      text.textContent = last ? t('timer.pausedShort', { s: last, time: fmtTime(SESSION_SECONDS - st.sessions[last].elapsedSec) }) : t('timer.notStarted');
      btn.textContent = last ? t('timer.resume') : '';
      btn.hidden = !last;
      btn.onclick = last ? () => startSession(last).then(tick) : null;
    }
  };
  views.add(box);
  box._update(status());
  return box;
}

/** Panell complet del mapa: botons «Iniciar sessió 2/3/4». */
export function timerPanel() {
  const info = h('p', { class: 'timer-big', 'aria-live': 'off' });
  const buttons = h('div', { class: 'btn-row' });
  const panel = h('section', { class: 'card timer-panel', 'aria-labelledby': 'timer-h' },
    h('h2', { id: 'timer-h' }, '⏱ ', t('timer.title')),
    info, buttons,
    h('p', { class: 'muted small' }, t('timer.explain', { n: OVERTIME_PENALTY }))
  );
  const btns = [2, 3, 4].map((n) => {
    const b = h('button', { type: 'button', class: 'btn' });
    b.addEventListener('click', () => (status().session === n ? pause() : startSession(n)).then(tick));
    buttons.append(b);
    return [n, b];
  });
  panel._update = (s) => {
    const st = s.st;
    info.textContent = s.session
      ? (s.overtime ? t('timer.overtimeLong', { s: s.session, time: fmtTime(-s.remaining) }) : t('timer.runningLong', { s: s.session, time: fmtTime(s.remaining) }))
      : t('timer.noneRunning');
    info.classList.toggle('overtime', Boolean(s.overtime));
    for (const [n, b] of btns) {
      const ses = st.sessions[n];
      const running = s.session === n;
      const label = running ? t('timer.pauseSession', { s: n }) : ses.started ? t('timer.resumeSession', { s: n }) : t('timer.startSession', { s: n });
      const time = ses.started ? ` (${fmtTime(Math.max(0, SESSION_SECONDS - ses.elapsedSec))})` : '';
      if (b.textContent !== label + time) b.textContent = label + time;
      b.className = running ? 'btn btn-primary' : 'btn';
      b.setAttribute('aria-pressed', running ? 'true' : 'false');
    }
  };
  views.add(panel);
  panel._update(status());
  return panel;
}
