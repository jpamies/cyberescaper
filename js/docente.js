// Pàgina docent: verificador de cadenes, resum del grup, CSV, guia de solucions.
// Tot es processa al navegador: els fitxers no surten de l'ordinador.
import { LANGS, DEFAULT_LANG, setLang, getLang, t, onLangChange } from './i18n.js';
import { h, clear, getPrefs, setPrefs, applyPrefs, downloadBlob, announce } from './ui.js';
import { verifyChain, validateChainData } from './chain.js';
import { deriveState, LEVEL_COUNT, SESSIONS } from './derive.js';
import { parseAny, parseExport } from './codec.js';
import { encrypt } from './caesar.js';
import { LEVEL0_ZONES, LEVEL1_SAMPLES, LEVEL3_ITEMS, LEVEL3_STEPS, LEVEL4_QUIZ_OK } from './levels/data.js';
import { MESSAGES, realClues } from './levels/level2-data.js';

const MAX_HINTS_PER_SESSION = 3;
const GOAL_TEAMS = 5;
let results = [];

async function analyse(name, text) {
  let parsed;
  try {
    parsed = await parseAny(text);
  } catch {
    return { name, valid: false };
  }
  const broken = await verifyChain(parsed.chain);
  const badData = validateChainData(parsed.chain);
  const st = deriveState(parsed.chain, Date.parse(parsed.header.generatedAt) || Date.now());
  return { name, valid: true, header: parsed.header, chain: parsed.chain, broken, badData, st };
}

function chrome() {
  const header = clear(document.getElementById('topbar'));
  const langSel = h('select', { id: 'lang-select', 'aria-label': t('a11y.language') },
    LANGS.map((l) => h('option', { value: l.code, selected: l.code === getLang(), lang: l.code }, l.label)));
  langSel.addEventListener('change', async () => { setPrefs({ lang: langSel.value }); await setLang(langSel.value); });
  const prefs = getPrefs();
  header.append(
    h('a', { class: 'brand', href: 'index.html' }, '🛡️ CyberEscaper 4.0'),
    h('nav', { class: 'mainnav', 'aria-label': t('nav.label') }, h('a', { href: 'index.html' }, '← ', t('teacher.back'))),
    h('button', { type: 'button', class: 'btn btn-small', 'aria-pressed': String(prefs.contrast), onclick: () => { setPrefs({ contrast: !getPrefs().contrast }); chrome(); } }, '◐ ', t('a11y.contrast')),
    h('div', { class: 'lang-box' }, h('span', { 'aria-hidden': 'true' }, '🌐'), langSel));
  clear(document.getElementById('footer')).append(h('p', {}, t('footer.privacy')), h('p', { class: 'small' }, t('footer.license')));
  document.getElementById('skip').textContent = t('a11y.skip');
  document.title = `CyberEscaper 4.0 · ${t('teacher.title')}`;
}

function fmtMin(sec) {
  return t('teacher.minutes', { n: Math.round(sec / 60) });
}

function integrityText(r) {
  if (!r.valid) return t('teacher.invalid');
  if (r.broken !== -1) return t('teacher.tampered', { n: r.broken });
  if (r.badData !== -1) return t('teacher.privacyIssue', { n: r.badData });
  return t('teacher.intact');
}

const isOk = (r) => r.valid && r.broken === -1 && r.badData === -1;
const hintsOkTeam = (st) => SESSIONS.every((s) => (st.hintsBySession[s] || 0) <= MAX_HINTS_PER_SESSION);

function teamCard(r) {
  if (!r.valid) return h('article', { class: 'card' }, h('h3', {}, r.name), h('p', { class: 'feedback ko' }, integrityText(r)));
  const st = r.st;
  return h('article', { class: 'card' + (isOk(r) ? '' : ' danger-zone') },
    h('h3', {}, '👥 ', st.team?.alias ?? r.header.alias),
    h('p', { class: 'small muted' }, t('teacher.file'), ': ', r.name),
    h('p', { class: 'feedback ' + (isOk(r) ? 'ok' : 'ko') }, integrityText(r)),
    h('div', { class: 'table-wrap' }, h('table', {},
      h('tbody', {},
        h('tr', {}, h('th', { scope: 'row' }, t('teacher.levels')), h('td', {}, `${Object.keys(st.completed).length} / ${LEVEL_COUNT}` + (Object.keys(st.completed).length ? ` (${Object.keys(st.completed).join(', ')})` : ''))),
        h('tr', {}, h('th', { scope: 'row' }, t('teacher.points')), h('td', {}, String(st.points))),
        h('tr', {}, h('th', { scope: 'row' }, t('teacher.hintsByLevel')), h('td', {}, Array.from({ length: LEVEL_COUNT }, (_, l) => `N${l}: ${st.hints[l].length}`).join(' · '))),
        h('tr', {}, h('th', { scope: 'row' }, t('teacher.hintsBySession')), h('td', {}, SESSIONS.map((s) => `S${s}: ${st.hintsBySession[s] || 0}`).join(' · '))),
        h('tr', {}, h('th', { scope: 'row' }, t('teacher.timeBySession')), h('td', {}, SESSIONS.map((s) => `S${s}: ${st.sessions[s].started ? fmtMin(st.sessions[s].elapsedSec) : '—'}${s in st.overtime ? ' ⏱+' : ''}`).join(' · ')))
      ))),
    h('details', {}, h('summary', {}, t('teacher.reports')),
      Array.from({ length: LEVEL_COUNT }, (_, l) => st.completed[l]
        ? h('div', {}, h('h4', {}, `${t('level.n', { n: l })} · ${t(`level${l}.title`)}`), h('blockquote', {}, st.completed[l].report))
        : null))
  );
}

function groupSummary() {
  const ok = results.filter(isOk);
  const total = ok.length;
  const completed = ok.filter((r) => 4 in r.st.completed).length;
  const hintOkTeams = ok.filter((r) => hintsOkTeam(r.st)).length;
  const perLevel = Array.from({ length: LEVEL_COUNT }, (_, l) => ok.reduce((a, r) => a + r.st.hints[l].length, 0));
  const max = Math.max(0, ...perLevel);
  const maxLevel = perLevel.indexOf(max);
  const goal = (cond) => h('span', { class: cond ? 'goal-ok' : 'goal-ko' }, cond ? '✔ ' + t('teacher.goalOk') : '✖ ' + t('teacher.goalKo'));

  const rows = ok.map((r) => h('tr', {},
    h('th', { scope: 'row' }, r.st.team.alias),
    SESSIONS.map((s) => { const n = r.st.hintsBySession[s] || 0; return h('td', {}, String(n), n > MAX_HINTS_PER_SESSION ? ' ✖' : ' ✔'); }),
    h('td', {}, hintsOkTeam(r.st) ? '✔' : '✖')));

  return h('section', { class: 'card', 'aria-labelledby': 'group-h' },
    h('h2', { id: 'group-h' }, '📊 ', t('teacher.groupTitle')),
    h('p', { class: 'small muted' }, t('teacher.onlyIntact')),
    h('p', {}, t('teacher.ind1', { n: completed, total }), ' ', t('teacher.goal1'), ' ', goal(completed >= GOAL_TEAMS)),
    h('p', {}, t('teacher.ind2'), ' ', t('teacher.ind2ok', { n: hintOkTeams, total }), ' ', goal(total > 0 && hintOkTeams === total)),
    total ? h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, t('teacher.alias')), SESSIONS.map((s) => h('th', { scope: 'col' }, `S${s}`)), h('th', { scope: 'col' }, t('teacher.goalOk')))),
      h('tbody', {}, rows))) : null,
    h('p', {}, max > 0 ? t('teacher.ind3', { level: `${maxLevel} · ${t(`level${maxLevel}.title`)}`, n: max }) : t('teacher.ind3none')),
    h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn btn-primary', disabled: results.length === 0, onclick: exportCsv }, '⬇ ', t('teacher.exportCsv'))));
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv() {
  const head = [t('teacher.csv.alias'), t('teacher.csv.integrity'), t('teacher.csv.levels'), t('teacher.csv.points'), t('teacher.csv.hints'),
    ...Array.from({ length: LEVEL_COUNT }, (_, l) => t('teacher.csv.hintsL', { n: l })),
    ...SESSIONS.map((s) => t('teacher.csv.hintsS', { n: s })),
    ...SESSIONS.map((s) => t('teacher.csv.timeS', { n: s })), t('teacher.csv.goal')];
  const lines = [head.map(csvCell).join(';')];
  for (const r of results) {
    if (!r.valid) { lines.push([r.name, integrityText(r)].map(csvCell).join(';')); continue; }
    const st = r.st;
    lines.push([
      st.team?.alias ?? r.header.alias, integrityText(r).replace(/^[✔✖⚠] /, ''), Object.keys(st.completed).length, st.points, st.hintCount,
      ...Array.from({ length: LEVEL_COUNT }, (_, l) => st.hints[l].length),
      ...SESSIONS.map((s) => st.hintsBySession[s] || 0),
      ...SESSIONS.map((s) => Math.round(st.sessions[s].elapsedSec / 60)),
      hintsOkTeam(st) ? 'OK' : 'KO'
    ].map(csvCell).join(';'));
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `cyberescaper_resum_${new Date().toISOString().slice(0, 10)}.csv`);
}

function renderResults(box) {
  clear(box);
  if (!results.length) { box.append(h('p', { class: 'muted' }, t('teacher.noResults'))); return; }
  box.append(groupSummary(), h('h2', {}, t('teacher.teamsTitle')), ...results.map(teamCard));
}

function solutions() {
  const hintsList = (l) => h('details', {}, h('summary', {}, '🛡 ', t('teacher.hintsTitle')),
    h('ol', {}, [0, 1, 2].map((i) => h('li', {}, t(`level${l}.hints.${i}`)))));
  const sec = (l, ...content) => h('section', { class: 'card inset' }, h('h3', {}, `${t('level.n', { n: l })} · ${t(`level${l}.title`)}`), ...content, hintsList(l));
  const plain = t('level4.plain');
  const reply = t('level4.reply');
  return h('section', { class: 'card', 'aria-labelledby': 'sol-h' },
    h('h2', { id: 'sol-h' }, '🗝 ', t('teacher.solutionsTitle')),
    h('p', { class: 'muted' }, t('teacher.solutionsHelp')),
    sec(0, h('p', {}, t('teacher.sol0')),
      h('ul', {}, LEVEL0_ZONES.map((z) => h('li', {}, z.risk ? '⚠ ' : '🌿 ', h('strong', {}, t(`level0.zones.${z.id}.label`)), ` — ${z.risk ? t('teacher.risk') : t('teacher.noRisk')}`)))),
    sec(1, h('p', {}, t('teacher.sol1')),
      h('ul', {}, LEVEL1_SAMPLES.map((s) => h('li', {}, h('code', {}, s.password), ' → ', h('strong', {}, t(`level1.levels.${s.answer}`)), ': ', t(`level1.explain.${s.id}`))))),
    sec(2, h('p', {}, t('teacher.sol2')),
      h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, [t('teacher.colMsg'), t('teacher.colChannel'), t('teacher.colType'), t('teacher.colClues')].map((c) => h('th', { scope: 'col' }, c)))),
        h('tbody', {}, MESSAGES.map((m) => h('tr', {},
          h('td', {}, String(m.id)), h('td', {}, t(`level2.channels.${m.channel}`)),
          h('td', {}, m.fraud ? '🚨 ' + t('teacher.fraud') : '✅ ' + t('teacher.legit')),
          h('td', {}, m.fraud ? [...new Set(realClues(m).map((c) => t(`level2.clue.${c.clue}`)))].join(', ') : '—'))))))),
    sec(3, h('p', {}, t('teacher.sol3')),
      h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, t('teacher.colData')), h('th', { scope: 'col' }, t('teacher.colMeasure')))),
        h('tbody', {}, LEVEL3_ITEMS.filter((i) => i.risk).map((i) => h('tr', {}, h('td', {}, t(`level3.items.${i.id}.label`)), h('td', {}, i.ok.map((m) => t(`level3.measures.${m}`)).join(' / '))))))),
      h('ol', {}, LEVEL3_STEPS.map((s) => h('li', {}, t(`level3.steps.${s}`))))),
    sec(4,
      h('p', {}, h('strong', {}, t('teacher.sol4cipher')), ': ', h('code', {}, encrypt(plain, 8))),
      h('p', {}, h('strong', {}, t('teacher.sol4plain')), ': ', h('code', {}, plain)),
      h('p', {}, h('strong', {}, t('teacher.sol4reply')), ': ', h('code', {}, `${reply} → ${encrypt(reply, 8)}`)),
      h('p', {}, t('teacher.sol4quiz'), ` (${LEVEL4_QUIZ_OK})`))
  );
}

function render() {
  chrome();
  const main = clear(document.getElementById('main'));
  const resultsBox = h('div', { 'aria-live': 'polite' });
  const files = h('input', { type: 'file', id: 'files', multiple: true, accept: '.json,application/json' });
  const code = h('textarea', { id: 'code', rows: '3', spellcheck: 'false' });
  const addFiles = async (list) => {
    for (const f of list) results.push(await analyse(f.name, await f.text()));
    renderResults(resultsBox);
    announce(t('teacher.teamsTitle') + ': ' + results.length);
  };
  files.addEventListener('change', async () => { await addFiles([...files.files]); files.value = ''; });
  const drop = h('div', { class: 'drop' }, h('label', { for: 'files' }, '📂 ', t('teacher.filesLabel')), files);
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', async (e) => { e.preventDefault(); drop.classList.remove('over'); await addFiles([...e.dataTransfer.files]); });

  main.append(
    h('h1', { tabindex: '-1' }, '🧑‍🏫 ', t('teacher.title')),
    h('p', { class: 'lead' }, t('teacher.intro')),
    h('p', { class: 'feedback ok' }, h('span', { 'aria-hidden': 'true' }, '🔒 '), h('strong', {}, t('teacher.privacy')), ' ', t('teacher.privacyLong')),
    h('p', { class: 'muted small' }, t('teacher.noPassword')),
    h('section', { class: 'card', 'aria-labelledby': 'ver-h' },
      h('h2', { id: 'ver-h' }, '🔍 ', t('teacher.verifierTitle')),
      drop,
      h('label', { for: 'code' }, t('teacher.codeLabel')), code,
      h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'btn', onclick: async () => { if (!code.value.trim()) return; results.push(await analyse('code', code.value)); code.value = ''; renderResults(resultsBox); } }, t('teacher.verifyCode')),
        h('button', { type: 'button', class: 'btn', onclick: () => { results = []; renderResults(resultsBox); } }, t('teacher.clear')))),
    resultsBox,
    solutions(),
    h('section', { class: 'card', 'aria-labelledby': 'use-h' },
      h('h2', { id: 'use-h' }, '📋 ', t('teacher.usageTitle')),
      h('ol', {}, t('teacher.usage').map((u) => h('li', {}, u))))
  );
  renderResults(resultsBox);
}

async function start() {
  applyPrefs();
  await setLang(getPrefs().lang || DEFAULT_LANG);
  onLangChange(render);
  render();
}

export { analyse, parseExport };
start().catch((e) => { console.warn(e); document.getElementById('main').textContent = 'Error: ' + e.message; });
