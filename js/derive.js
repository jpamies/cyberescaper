// Estat de la partida derivat NOMÉS dels blocs de la cadena.
// Mòdul pur: el fan servir l'app (state.js), la pàgina docent i els tests.

export const LEVEL_COUNT = 5;
export const LEVEL_POINTS = [10, 20, 20, 25, 25];
export const HINT_COST = 2;
export const HINTS_PER_LEVEL = 3;
export const OVERTIME_PENALTY = 5;
export const SESSION_SECONDS = 50 * 60;
export const SESSIONS = [2, 3, 4];
export const LEVEL_SESSION = { 0: 2, 1: 3, 2: 3, 3: 4, 4: 4 };
export const LEVEL0_CODE = 8;
export const BADGES = ['access', 'passwords', 'phishing', 'identity', 'crypto'];
export const NO_HINTS_BADGE = 'nohints';

export function deriveState(chain, now = Date.now()) {
  const st = {
    team: null,
    completed: {},
    hints: {},
    hintsBySession: { 2: 0, 3: 0, 4: 0, none: 0 },
    sessions: {},
    activeSession: null,
    overtime: {},
    imports: 0,
    finished: false,
    final: null,
    lastTimestamp: null
  };
  for (const s of SESSIONS) st.sessions[s] = { elapsedSec: 0, running: false, startedAt: null, base: 0, started: false };
  for (let l = 0; l < LEVEL_COUNT; l++) st.hints[l] = [];

  let lastStarted = null;
  for (const b of chain) {
    const d = b.data || {};
    const ts = Date.parse(b.timestamp);
    st.lastTimestamp = b.timestamp;
    switch (b.type) {
      case 'genesis':
        st.team = { alias: d.alias, members: d.members || [], lang: d.lang, date: d.date, appVersion: d.appVersion };
        break;
      case 'session_start': {
        const s = st.sessions[d.session];
        if (!s) break;
        // si n'hi havia una altra en marxa, es tanca en aquest moment
        if (st.activeSession && st.activeSession !== d.session) closeSession(st, st.activeSession, ts);
        if (!s.running) {
          s.running = true;
          s.started = true;
          s.startedAt = ts;
          s.base = s.elapsedSec;
        }
        st.activeSession = d.session;
        lastStarted = d.session;
        break;
      }
      case 'session_pause': {
        const s = st.sessions[d.session];
        if (!s) break;
        s.running = false;
        s.elapsedSec = typeof d.elapsedSec === 'number' ? d.elapsedSec : s.base + Math.max(0, (ts - s.startedAt) / 1000);
        s.base = s.elapsedSec;
        s.startedAt = null;
        if (st.activeSession === d.session) st.activeSession = null;
        break;
      }
      case 'overtime':
        st.overtime[d.session] = (d.penalty ?? OVERTIME_PENALTY);
        break;
      case 'hint_used':
        if (st.hints[d.level] && !st.hints[d.level].includes(d.hint)) {
          st.hints[d.level].push(d.hint);
          const key = st.activeSession ?? lastStarted ?? 'none';
          st.hintsBySession[key] = (st.hintsBySession[key] || 0) + 1;
        }
        break;
      case 'level_completed':
        if (!(d.level in st.completed)) st.completed[d.level] = { ...d, timestamp: b.timestamp };
        break;
      case 'import':
        st.imports++;
        break;
      case 'final':
        st.finished = true;
        st.final = d;
        break;
    }
  }
  // sessió en marxa: temps fins ara
  for (const s of SESSIONS) {
    const ses = st.sessions[s];
    if (ses.running) ses.elapsedSec = ses.base + Math.max(0, (now - ses.startedAt) / 1000);
  }

  let current = 0;
  while (current < LEVEL_COUNT && current in st.completed) current++;
  st.currentLevel = current; // 5 = tot superat

  let levelPoints = 0;
  for (const l of Object.keys(st.completed)) levelPoints += Number(st.completed[l].points) || 0;
  const hintCount = Object.values(st.hints).reduce((a, h) => a + h.length, 0);
  const overtimePenalty = Object.values(st.overtime).reduce((a, p) => a + p, 0);
  st.hintCount = hintCount;
  st.levelPoints = levelPoints;
  st.points = Math.max(0, levelPoints - hintCount * HINT_COST - overtimePenalty);

  st.badges = [];
  st.noHintLevels = [];
  for (let l = 0; l < LEVEL_COUNT; l++) {
    if (l in st.completed) {
      st.badges.push(BADGES[l]);
      if (st.hints[l].length === 0) st.noHintLevels.push(l);
    }
  }
  return st;
}

function closeSession(st, session, ts) {
  const s = st.sessions[session];
  if (!s || !s.running) return;
  s.elapsedSec = s.base + Math.max(0, (ts - s.startedAt) / 1000);
  s.base = s.elapsedSec;
  s.running = false;
  s.startedAt = null;
}

export function isLevelUnlocked(st, level) {
  return level <= st.currentLevel;
}

/** Resum comparable de l'estat (per comprovar que una importació el restaura igual). */
export function stateFingerprint(st) {
  return JSON.stringify({
    team: st.team,
    currentLevel: st.currentLevel,
    points: st.points,
    badges: st.badges,
    noHintLevels: st.noHintLevels,
    hints: st.hints,
    completed: Object.keys(st.completed),
    overtime: st.overtime,
    finished: st.finished
  });
}
