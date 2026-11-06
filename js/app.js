// CyberEscaper 4.0 · router per hash i pantalles generals.
import { LANGS, DEFAULT_LANG, setLang, getLang, t, onLangChange, loadDict, lookup } from './i18n.js';
import { h, clear, announce, toast, dialog, getPrefs, setPrefs, applyPrefs, shadowMessage, downloadBlob } from './ui.js';
import { speakButton, stop as stopSpeech } from './tts.js';
import * as state from './state.js';
import * as timer from './timer.js';
import { ALIAS_RE, verifyChain } from './chain.js';
import { LEVEL_COUNT, LEVEL_POINTS, LEVEL0_CODE, LEVEL_SESSION } from './derive.js';
import { exportFileName } from './codec.js';
import { badgeList, scoreSummary } from './summary.js';
import { chainCards } from './chainview.js';
import { memberLabel } from './levels/common.js';

const ROLES = ['coordinador', 'portaveu', 'tecnic', 'secretari'];
const SPECIALTIES = ['passwords', 'phishing', 'identity', 'crypto'];
const AVATARS = ['🦊', '🐙', '🦉', '🐺', '🐼', '🐯', '🦄', '🐸', '🐧', '🐝', '🦖', '🤖', '👾', '🛰️'];
const GLOSSARY = [
  ['password', '🔑'], ['link', '🔗'], ['sender', '📨'], ['attachment', '📎'], ['phishing', '🎣'], ['smishing', '📱'],
  ['malware', '🦠'], ['ransomware', '💰'], ['encrypt', '🔐'], ['decrypt', '🔓'], ['hash', '#️⃣'], ['twofa', '📲'],
  ['backup', '💾'], ['privacy', '🙈'], ['footprint', '👣'], ['update', '🔄']
];

const main = () => document.getElementById('main');
let currentCleanup = null;

// ---------------------------------------------------------------------------
// Capçalera i peu
// ---------------------------------------------------------------------------
function renderChrome() {
  const header = clear(document.getElementById('topbar'));
  const prefs = getPrefs();
  const langSel = h('select', { id: 'lang-select', 'aria-label': t('a11y.language') },
    LANGS.map((l) => h('option', { value: l.code, selected: l.code === getLang(), lang: l.code }, l.label)));
  langSel.addEventListener('change', async () => {
    setPrefs({ lang: langSel.value });
    await setLang(langSel.value);
    document.getElementById('lang-select')?.focus();
  });

  const fontBtns = h('div', { class: 'seg-group', role: 'group', 'aria-label': t('a11y.fontSize') },
    ['A', 'A+', 'A++'].map((label, i) => h('button', {
      type: 'button', class: 'btn btn-small', 'aria-pressed': String(prefs.font === i), title: t(`a11y.font${i}`),
      onclick: () => { setPrefs({ font: i }); renderChrome(); document.querySelectorAll('.seg-group .btn')[i]?.focus(); }
    }, h('span', { 'aria-hidden': 'true' }, label), h('span', { class: 'sr-only' }, t(`a11y.font${i}`)))));

  const toggle = (key, label, icon) => h('button', {
    type: 'button', class: 'btn btn-small', 'aria-pressed': String(Boolean(prefs[key])),
    onclick: (e) => { setPrefs({ [key]: !getPrefs()[key] }); const id = e.currentTarget.id; renderChrome(); document.getElementById(id)?.focus(); },
    id: `toggle-${key}`
  }, h('span', { 'aria-hidden': 'true' }, icon + ' '), label);

  const hasTeam = state.hasTeam();
  header.append(...[
    h('a', { class: 'brand', href: hasTeam ? '#/mapa' : '#/inici' }, h('span', { 'aria-hidden': 'true' }, '🛡️ '), 'CyberEscaper 4.0'),
    h('nav', { class: 'mainnav', 'aria-label': t('nav.label') },
      hasTeam ? h('a', { href: '#/mapa' }, '🗺️ ', t('nav.map')) : null,
      h('a', { href: '#/glossari' }, '📖 ', t('nav.glossary'))),
    hasTeam ? timer.timerBadge() : null,
    h('details', { class: 'a11y-menu' },
      h('summary', {}, h('span', { 'aria-hidden': 'true' }, '♿ '), t('a11y.menu')),
      h('div', { class: 'a11y-panel' },
        h('p', { class: 'a11y-row' }, h('span', { class: 'small' }, t('a11y.fontSize')), fontBtns),
        h('p', { class: 'a11y-row' }, toggle('contrast', t('a11y.contrast'), '◐')),
        h('p', { class: 'a11y-row' }, toggle('typewriter', t('a11y.typewriter'), '⌨')),
        h('p', { class: 'a11y-row' }, h('button', { type: 'button', class: 'btn btn-small', onclick: () => stopSpeech() }, '⏹ ', t('a11y.stop'))))),
    h('div', { class: 'lang-box' }, h('span', { 'aria-hidden': 'true' }, '🌐'), langSel)
  ].filter(Boolean));

  const footer = clear(document.getElementById('footer'));
  footer.append(
    h('p', {}, t('footer.privacy')),
    h('p', { class: 'small' }, t('footer.license'), ' · ', h('a', { href: 'docente.html', class: 'teacher-link' }, t('footer.teacher')))
  );
  document.getElementById('skip').textContent = t('a11y.skip');
  document.title = t('meta.appTitle');
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '') || 'inici';
  const [page, arg] = raw.split('/');
  return { page: page === 'inicio' ? 'inici' : page, arg };
}

export function navigate(hash, { replace = false } = {}) {
  if (location.hash === hash || replace) render();
  else location.hash = hash;
}

async function render() {
  stopSpeech();
  if (currentCleanup) { currentCleanup(); currentCleanup = null; }
  const root = clear(main());
  const { page, arg } = parseRoute();
  const has = state.hasTeam();
  const st = state.derived();
  const needTeam = ['mapa', 'nivell', 'final', 'cadena'];
  if (needTeam.includes(page) && !has) { location.replace('#/equip'); return; }

  switch (page) {
    case 'inici': renderHome(root); break;
    case 'equip': renderTeam(root); break;
    case 'mapa': renderMap(root); break;
    case 'nivell': {
      const n = Number(arg);
      if (!(n >= 0 && n < LEVEL_COUNT) || n > st.currentLevel) { toast(t('map.lockedToast')); location.replace('#/mapa'); return; }
      const mod = await import(`./levels/level${n}.js`);
      mod.render(root, { navigate });
      break;
    }
    case 'final':
      if (!st.finished) { location.replace('#/mapa'); return; }
      renderFinal(root);
      break;
    case 'cadena': await renderChain(root); break;
    case 'glossari': await renderGlossary(root); break;
    default: location.replace('#/inici'); return;
  }
  const h1 = root.querySelector('h1');
  if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: false }); }
  window.scrollTo(0, 0);
}

function titleRow(text, speakText) {
  return h('div', { class: 'title-row' }, h('h1', { tabindex: '-1' }, text), speakButton(speakText ?? (() => text), typeof text === 'string' ? text : ''));
}

// ---------------------------------------------------------------------------
// Portada
// ---------------------------------------------------------------------------
function renderHome(root) {
  const has = state.hasTeam();
  root.append(
    h('div', { class: 'red-alert', role: 'alert' },
      h('span', { class: 'siren', 'aria-hidden': 'true' }, '🚨'),
      h('p', { class: 'alert-text' }, t('home.alert')),
      h('div', { class: 'scanline', 'aria-hidden': 'true' })),
    titleRow(t('home.title'), () => `${t('home.title')}. ${t('home.shadows')} ${t('home.intro')}`),
    shadowMessage(t('home.shadows')),
    h('p', { class: 'lead' }, t('home.intro')),
    h('ul', { class: 'plan' }, [2, 3, 4].map((s) => h('li', {}, h('strong', {}, t('home.session', { s })), ' ', t(`home.plan${s}`)))),
    h('div', { class: 'btn-row' },
      h('a', { class: 'btn btn-primary btn-big', href: has ? '#/mapa' : '#/equip' }, h('span', { 'aria-hidden': 'true' }, '🛡️ '), has ? t('home.continue') : t('home.enter')),
      has ? null : h('a', { class: 'btn', href: '#/equip' }, t('home.import')))
  );
}

// ---------------------------------------------------------------------------
// Registre de l'equip
// ---------------------------------------------------------------------------
function importBox() {
  const fileId = 'import-file';
  const codeId = 'import-code';
  const out = h('div', { role: 'status', 'aria-live': 'polite' });
  const file = h('input', { type: 'file', id: fileId, accept: '.json,application/json' });
  const code = h('textarea', { id: codeId, rows: '3', spellcheck: 'false', placeholder: t('import.codePlaceholder') });
  const doImport = async (input) => {
    if (state.hasTeam()) {
      const ok = await dialog({ title: t('import.replaceTitle'), body: t('import.replaceBody'), confirmText: t('import.replaceYes'), danger: true });
      if (!ok) return;
    }
    const r = await state.importGame(input);
    clear(out);
    if (r.ok) {
      announce(t('import.ok', { alias: r.alias }), { assertive: true });
      out.append(h('p', { class: 'feedback ok' }, '✔ ', t('import.ok', { alias: r.alias })));
      renderChrome();
      setTimeout(() => navigate('#/mapa'), 600);
    } else {
      const msg = r.reason === 'tampered' ? t('import.tampered', { n: r.broken })
        : r.reason === 'privacy' ? t('import.privacy', { n: r.broken })
        : r.reason === 'code' ? t('import.badCode') : t('import.badFormat');
      out.append(h('p', { class: 'feedback ko' }, '✖ ', msg));
      announce(msg, { assertive: true });
    }
  };
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    await doImport(await f.text());
    file.value = '';
  });
  return h('section', { class: 'card', 'aria-labelledby': 'import-h' },
    h('h2', { id: 'import-h' }, '📂 ', t('import.title')),
    h('p', { class: 'muted' }, t('import.help')),
    h('label', { for: fileId }, t('import.file')), file,
    h('label', { for: codeId }, t('import.code')), code,
    h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn', onclick: () => code.value.trim() && doImport(code.value) }, t('import.button'))),
    out);
}

function renderTeam(root) {
  root.append(titleRow(t('team.title'), () => `${t('team.title')}. ${t('team.warn')}`));
  if (state.hasTeam()) {
    const st = state.derived();
    root.append(h('section', { class: 'card' },
      h('p', {}, t('team.existing', { alias: st.team.alias })),
      h('ul', { class: 'members' }, st.team.members.map((m) => h('li', {}, memberLabel(m), ' · ', t(`roles.${m.role}`), ' · ', t(`specialties.${m.specialty}`)))),
      h('div', { class: 'btn-row' },
        h('a', { class: 'btn btn-primary', href: '#/mapa' }, t('team.continue')),
        h('button', { type: 'button', class: 'btn btn-danger', onclick: async () => {
          const ok = await dialog({ title: t('team.newTitle'), body: t('team.newBody'), confirmText: t('team.newYes'), danger: true });
          if (ok) { state.wipe(); renderChrome(); render(); }
        } }, t('team.newGame')))));
    root.append(importBox());
    return;
  }

  const draftKey = 'cyberescaper:v1:teamform';
  let draft;
  try { draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null'); } catch { draft = null; }
  draft ??= { alias: '', count: 4, members: Array.from({ length: 5 }, (_, i) => ({ role: ROLES[i % 4], specialty: SPECIALTIES[i % 4], avatar: AVATARS[i], initial: '' })) };
  const saveDraft = () => { try { sessionStorage.setItem(draftKey, JSON.stringify(draft)); } catch { /* res */ } };

  const errors = h('div', { class: 'errors', role: 'alert' });
  const alias = h('input', { id: 'alias', value: draft.alias, maxlength: '20', autocomplete: 'off', 'aria-describedby': 'alias-help alias-warn', required: true, spellcheck: 'false' });
  alias.addEventListener('input', () => { draft.alias = alias.value; saveDraft(); });
  const count = h('select', { id: 'count' }, [4, 5].map((n) => h('option', { value: String(n), selected: draft.count === n }, String(n))));
  const membersBox = h('div', { class: 'members-grid' });
  const renderMembers = () => {
    clear(membersBox);
    for (let i = 0; i < draft.count; i++) {
      const m = draft.members[i];
      const sel = (key, opts, labelKey, prefix) => {
        const id = `m${i}-${key}`;
        const s = h('select', { id }, opts.map((o) => h('option', { value: o, selected: m[key] === o }, prefix(o))));
        s.addEventListener('change', () => { m[key] = s.value; saveDraft(); });
        return [h('label', { for: id }, t(labelKey)), s];
      };
      const initialId = `m${i}-initial`;
      const initial = h('input', { id: initialId, value: m.initial, maxlength: '1', class: 'tiny-input', autocomplete: 'off', 'aria-describedby': 'initial-help' });
      initial.addEventListener('input', () => { m.initial = initial.value.replace(/[^\p{L}]/gu, '').slice(0, 1).toUpperCase(); initial.value = m.initial; saveDraft(); });
      membersBox.append(h('fieldset', { class: 'member card inset' },
        h('legend', {}, t('team.member', { n: i + 1 })),
        ...sel('role', ROLES, 'team.role', (o) => t(`roles.${o}`)),
        ...sel('specialty', SPECIALTIES, 'team.specialty', (o) => t(`specialtyIcons.${o}`) + ' ' + t(`specialties.${o}`)),
        ...sel('avatar', AVATARS, 'team.avatar', (o) => o),
        h('label', { for: initialId }, t('team.initial')), initial));
    }
  };
  count.addEventListener('change', () => { draft.count = Number(count.value); saveDraft(); renderMembers(); });
  renderMembers();

  const form = h('form', { class: 'card team-form', novalidate: true },
    h('p', { class: 'warning strong', id: 'alias-warn' }, h('span', { 'aria-hidden': 'true' }, '⚠ '), t('team.warn')),
    h('label', { for: 'alias' }, t('team.alias')), alias,
    h('p', { class: 'muted small', id: 'alias-help' }, t('team.aliasHelp')),
    h('label', { for: 'count' }, t('team.count')), count,
    h('h2', {}, t('team.membersTitle')),
    h('p', { class: 'muted small' }, t('team.membersHelp')),
    h('p', { class: 'muted small', id: 'initial-help' }, t('team.initialHelp')),
    membersBox, errors,
    h('div', { class: 'btn-row' }, h('button', { type: 'submit', class: 'btn btn-primary btn-big' }, '🛡️ ', t('team.submit'))));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clear(errors);
    const errs = [];
    const a = alias.value.trim();
    if (!ALIAS_RE.test(a)) errs.push(t('team.errAlias'));
    const members = draft.members.slice(0, draft.count).map((m) => {
      const out = { role: m.role, specialty: m.specialty, avatar: m.avatar };
      if (m.initial) out.initial = m.initial;
      return out;
    });
    const missingRoles = ROLES.filter((r) => !members.some((m) => m.role === r));
    const missingSpecs = SPECIALTIES.filter((s) => !members.some((m) => m.specialty === s));
    if (missingRoles.length) errs.push(t('team.errRoles', { list: missingRoles.map((r) => t(`roles.${r}`)).join(', ') }));
    if (missingSpecs.length) errs.push(t('team.errSpecs', { list: missingSpecs.map((s) => t(`specialties.${s}`)).join(', ') }));
    if (errs.length) {
      errors.append(h('ul', {}, errs.map((x) => h('li', {}, '✖ ', x))));
      if (!ALIAS_RE.test(a)) { alias.setAttribute('aria-invalid', 'true'); alias.focus(); }
      return;
    }
    await state.createTeam({ alias: a, members, lang: getLang() });
    try { sessionStorage.removeItem(draftKey); } catch { /* res */ }
    renderChrome();
    navigate('#/mapa');
  });
  root.append(form, importBox());
}

// ---------------------------------------------------------------------------
// Mapa de missió
// ---------------------------------------------------------------------------
function downloadPanel() {
  const status = h('p', { role: 'status', 'aria-live': 'polite', class: 'small' });
  const alias = state.derived().team.alias;
  return h('section', { class: 'card', 'aria-labelledby': 'dl-h' },
    h('h2', { id: 'dl-h' }, '💾 ', t('download.title')),
    h('p', { class: 'muted small' }, t('download.help')),
    h('div', { class: 'btn-row' },
      h('button', { type: 'button', class: 'btn', onclick: () => {
        const obj = state.exportObject();
        downloadBlob(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), exportFileName(alias, 'json'));
        status.textContent = t('download.jsonDone');
      } }, '⬇ ', t('download.json')),
      h('button', { type: 'button', class: 'btn', onclick: async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        status.textContent = t('download.pdfWorking');
        try {
          const { generatePdf } = await import('./pdf.js');
          const blob = await generatePdf(state.exportObject());
          downloadBlob(blob, exportFileName(alias, 'pdf'));
          status.textContent = t('download.pdfDone');
        } catch (err) {
          console.warn(err);
          status.textContent = t('download.pdfError');
        } finally { btn.disabled = false; }
      } }, '⬇ ', t('download.pdf')),
      h('a', { class: 'btn', href: '#/cadena' }, '⛓ ', t('final.viewChain'))),
    status);
}

function renderMap(root) {
  const st = state.derived();
  root.append(titleRow(t('map.title'), () => `${t('map.title')}. ${t('map.help')}`));
  root.append(h('p', { class: 'lead' }, t('map.help')));

  const stats = h('section', { class: 'card stats', 'aria-label': t('map.statsLabel') },
    h('p', {}, h('span', { 'aria-hidden': 'true' }, '👥 '), t('map.team'), ': ', h('strong', {}, st.team.alias), ' · ',
      st.team.members.map((m) => memberLabel(m)).join(' ')),
    h('p', { class: 'points' }, h('span', { 'aria-hidden': 'true' }, '⭐ '), t('map.points', { n: st.points })),
    h('p', {}, h('span', { 'aria-hidden': 'true' }, '🏅 '), t('map.badges'), ': ', badgeList(st, t).join(' · ') || t('map.noBadges')),
    0 in st.completed ? h('p', { class: 'code-recovered' }, t('level0.codeRecovered', { code: LEVEL0_CODE })) : null);

  const levels = h('ol', { class: 'levels' });
  for (let l = 0; l < LEVEL_COUNT; l++) {
    const done = l in st.completed;
    const open = l <= st.currentLevel;
    const status = done ? t('map.statusDone') : open ? t('map.statusOpen') : t('map.statusLocked');
    const icon = done ? '✅' : open ? '▶️' : '🔒';
    const inner = [
      h('span', { class: 'lvl-icon', 'aria-hidden': 'true' }, icon),
      h('span', { class: 'lvl-body' },
        h('span', { class: 'lvl-num' }, t('level.n', { n: l })),
        h('strong', { class: 'lvl-title' }, t(`level${l}.title`)),
        h('span', { class: 'lvl-meta' }, `${status} · ${t('map.sessionN', { s: LEVEL_SESSION[l] })} · ${LEVEL_POINTS[l]} ${t('map.pts')}`),
        done ? h('span', { class: 'lvl-meta' }, scoreSummary(l, st.completed[l].score, t)) : null)
    ];
    levels.append(h('li', { class: 'lvl ' + (done ? 'done' : open ? 'open' : 'locked') },
      open ? h('a', { href: `#/nivell/${l}`, class: 'lvl-link' }, inner) : h('div', { class: 'lvl-link', 'aria-disabled': 'true' }, inner, h('span', { class: 'sr-only' }, t('map.lockedHelp')))));
  }

  root.append(h('div', { class: 'map-grid' },
    h('div', {}, stats, h('section', { 'aria-labelledby': 'levels-h' }, h('h2', { id: 'levels-h' }, t('map.levelsTitle')), levels),
      st.finished ? h('p', {}, h('a', { class: 'btn btn-primary', href: '#/final' }, t('lock.toFinal'))) : null),
    h('div', {}, timer.timerPanel(), downloadPanel())));
}

// ---------------------------------------------------------------------------
// Pantalla final
// ---------------------------------------------------------------------------
function renderFinal(root) {
  const st = state.derived();
  root.append(
    h('div', { class: 'restored', role: 'status' }, h('span', { 'aria-hidden': 'true' }, '✅ '), t('final.restored')),
    titleRow(t('final.title'), () => `${t('final.title')}. ${t('final.text')}`),
    h('p', { class: 'lead' }, t('final.text')),
    shadowMessage(t('final.shadows')),
    h('section', { class: 'card' },
      h('h2', {}, t('final.summary')),
      h('p', { class: 'points' }, '⭐ ', t('map.points', { n: st.points })),
      h('p', {}, '🏅 ', badgeList(st, t).join(' · ')),
      h('ul', {}, Array.from({ length: LEVEL_COUNT }, (_, l) => h('li', {}, h('strong', {}, `${t('level.n', { n: l })} · ${t(`level${l}.title`)}: `), scoreSummary(l, st.completed[l]?.score, t), ` · ${t('final.hints', { n: st.hints[l].length })}`)))),
    h('p', { class: 'warning' }, '📤 ', t('final.deliver')),
    downloadPanel(),
    h('section', { class: 'card danger-zone' },
      h('h2', {}, '🧹 ', t('final.wipeTitle')),
      h('p', {}, t('final.wipeHelp')),
      h('button', { type: 'button', class: 'btn btn-danger', onclick: async () => {
        const ok = await dialog({ title: t('final.wipeConfirmTitle'), body: t('final.wipeConfirmBody'), confirmText: t('final.wipeYes'), danger: true });
        if (!ok) return;
        state.wipe();
        renderChrome();
        toast(t('final.wiped'));
        navigate('#/inici');
      } }, t('final.wipe')))
  );
}

// ---------------------------------------------------------------------------
// Veure la cadena
// ---------------------------------------------------------------------------
async function renderChain(root) {
  const chain = state.getChain();
  const b = await verifyChain(chain);
  root.append(
    titleRow(t('chainView.title')),
    h('p', {}, t('chainView.help')),
    h('p', { class: 'feedback ' + (b === -1 ? 'ok' : 'ko') }, b === -1 ? '✔ ' + t('chainView.ok', { n: chain.length }) : '✖ ' + t('chainView.ko', { n: b })),
    chainCards(chain, { brokenFrom: b }),
    h('p', {}, h('a', { class: 'btn', href: state.derived().finished ? '#/final' : '#/mapa' }, '← ', t('nav.back'))));
}

// ---------------------------------------------------------------------------
// Glossari
// ---------------------------------------------------------------------------
async function renderGlossary(root) {
  const dicts = await Promise.all(LANGS.map(async (l) => [l, await loadDict(l.code)]));
  root.append(titleRow(t('glossary.title')), h('p', {}, t('glossary.help')));
  const list = h('dl', { class: 'glossary' });
  for (const [key, icon] of GLOSSARY) {
    const def = t(`glossary.terms.${key}.def`);
    const term = t(`glossary.terms.${key}.term`);
    list.append(h('div', { class: 'term card' },
      h('dt', {},
        h('span', { class: 'picto', role: 'img', 'aria-label': term }, icon),
        h('span', { class: 'term-names' }, dicts.map(([l, d]) => h('span', { lang: l.code, class: 'term-name' }, h('small', {}, l.code.toUpperCase()), ' ', lookup(d, `glossary.terms.${key}.term`))))),
      h('dd', {}, def, ' ', speakButton(() => `${term}. ${def}`, term))));
  }
  root.append(list, h('p', {}, h('button', { type: 'button', class: 'btn', onclick: () => history.back() }, '← ', t('nav.back'))));
}

// ---------------------------------------------------------------------------
// Arrencada
// ---------------------------------------------------------------------------
async function start() {
  applyPrefs();
  const prefs = getPrefs();
  await setLang(prefs.lang || DEFAULT_LANG);
  const res = await state.load();
  if (res.corrupted !== undefined) toast(t('errors.cacheCorrupted'));
  await timer.reconcile();
  renderChrome();
  timer.startTicking();
  onLangChange(() => { renderChrome(); render(); });
  window.addEventListener('hashchange', render);
  state.onChange(() => {
    // actualitza la capçalera només quan canvia l'existència de l'equip
    const has = state.hasTeam();
    if (has !== start._hadTeam) { start._hadTeam = has; renderChrome(); }
  });
  start._hadTeam = state.hasTeam();
  await render();
}

if (!window.isSecureContext || !window.crypto?.subtle) {
  document.getElementById('main').innerHTML = '<div class="card"><h1>CyberEscaper</h1><p lang="ca">Cal obrir l\'app amb https o des de localhost (python3 -m http.server), no amb file://.</p><p lang="es">Hay que abrir la app con https o desde localhost (python3 -m http.server), no con file://.</p></div>';
} else {
  start().catch((e) => {
    console.warn(e);
    document.getElementById('main').textContent = 'Error: ' + e.message;
  });
}
