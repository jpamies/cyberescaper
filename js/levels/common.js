// Estructura comuna de tots els nivells: introducció, repte, Targetes Firewall,
// informe obligatori i cadenat.
import { t } from '../i18n.js';
import { h, clear, announce, dialog, shadowMessage } from '../ui.js';
import { speakButton } from '../tts.js';
import * as state from '../state.js';
import { LEVEL_POINTS, HINT_COST, HINTS_PER_LEVEL, LEVEL0_CODE, BADGES, LEVEL_SESSION } from '../derive.js';
import { finalData, scoreSummary } from '../summary.js';

export const REPORT_MIN = 40;
const SPECIALTY_BY_LEVEL = { 1: 'passwords', 2: 'phishing', 3: 'identity', 4: 'crypto' };

export function memberLabel(m) {
  return [m.avatar, m.initial].filter(Boolean).join(' ') || '•';
}

/**
 * def = {
 *   body(draft, save, api) -> Node      el repte
 *   check(draft) -> {ok, reason, score} el cadenat
 *   success?(draft) -> Node             contingut extra en obrir el cadenat
 *   reportGuard?(text) -> string|null   motiu per rebutjar l'informe
 * }
 */
export function renderLevel(root, level, def, { navigate }) {
  const st = state.derived();
  const title = t(`level${level}.title`);
  const draft = state.getDraft(level);
  const save = () => state.setDraft(level, draft);

  const h1 = h('h1', { tabindex: '-1' }, h('span', { class: 'kicker' }, t('level.n', { n: level })), ' ', title);
  const introText = t(`level${level}.intro`);
  const taskText = t(`level${level}.task`);
  root.append(
    h('div', { class: 'title-row' }, h1, speakButton(() => `${t('level.n', { n: level })}. ${title}. ${introText} ${taskText}`, title)),
    specialistLine(level, st),
    shadowMessage(introText)
  );

  if (level in st.completed) {
    root.append(completedCard(level, st.completed[level], navigate));
    return;
  }

  const taskP = h('p', { class: 'task' }, taskText);
  root.append(h('div', { class: 'task-row' }, taskP, speakButton(taskP, t('level.taskLabel'))));

  const api = { level, announce, rerender: () => navigate(location.hash, { replace: true }) };
  const body = def.body(draft, save, api);
  root.append(h('div', { class: 'level-layout' },
    h('div', { class: 'challenge' }, body),
    hintsPanel(level)
  ));

  // --- informe del nivell ---
  const reportId = `report-${level}`;
  const counter = h('span', { class: 'counter', id: reportId + '-count', 'aria-live': 'polite' });
  const textarea = h('textarea', {
    id: reportId, rows: '4', maxlength: '500', 'aria-describedby': `${reportId}-help ${reportId}-count`,
    spellcheck: 'true'
  });
  textarea.value = draft.report || '';
  const updateCounter = () => {
    const n = [...textarea.value.trim()].length;
    counter.textContent = t('report.counter', { n, min: REPORT_MIN });
    counter.classList.toggle('ok', n >= REPORT_MIN);
  };
  textarea.addEventListener('input', () => { draft.report = textarea.value; save(); updateCounter(); });
  updateCounter();

  const lockStatus = h('div', { class: 'lock-status', role: 'status', 'aria-live': 'polite' });
  const lockBtn = h('button', { type: 'button', class: 'btn btn-primary btn-lock' }, h('span', { 'aria-hidden': 'true' }, '🔒 '), t('lock.open'));

  root.append(h('section', { class: 'card report-card', 'aria-labelledby': `${reportId}-h` },
    h('h2', { id: `${reportId}-h` }, '📝 ', t('report.title')),
    h('p', { id: `${reportId}-help`, class: 'muted' }, t('report.help', { min: REPORT_MIN })),
    h('p', { class: 'warning' }, h('span', { 'aria-hidden': 'true' }, '⚠ '), t('report.privacy')),
    h('label', { for: reportId }, t('report.label')),
    textarea, counter,
    h('div', { class: 'lock-row' }, lockBtn),
    lockStatus
  ));

  lockBtn.addEventListener('click', async () => {
    const result = await def.check(draft);
    const report = textarea.value.trim();
    let reason = null;
    if (!result.ok) reason = result.reason;
    else if ([...report].length < REPORT_MIN) reason = t('report.tooShort', { min: REPORT_MIN });
    else if (def.reportGuard) reason = def.reportGuard(report);

    if (reason) {
      if (!result.ok) { draft.attempts = (draft.attempts || 0) + 1; save(); }
      lockStatus.className = 'lock-status closed';
      clear(lockStatus).append(h('span', { 'aria-hidden': 'true' }, '🔒 '), t('lock.closed'), ' ', reason);
      announce(t('lock.closed') + ' ' + reason, { assertive: true });
      return;
    }
    lockBtn.disabled = true;
    const cur = state.derived();
    const data = {
      level, points: LEVEL_POINTS[level], hintsUsed: cur.hints[level].length,
      attempts: (draft.attempts || 0) + 1, score: result.score, report
    };
    await state.append('level_completed', data);
    if (level === 4) await state.append('final', finalData(state.derived()));
    state.setDraft(level, null);
    announce(t('lock.opened', { points: LEVEL_POINTS[level] }), { assertive: true });
    showSuccess(root, level, def.success?.(draft), navigate);
  });
}

function specialistLine(level, st) {
  const spec = SPECIALTY_BY_LEVEL[level];
  if (!spec) return h('p', { class: 'specialist' }, h('span', { 'aria-hidden': 'true' }, '👥 '), t('level.everyone'));
  const who = (st.team?.members || []).filter((m) => m.specialty === spec);
  return h('p', { class: 'specialist' },
    h('span', { 'aria-hidden': 'true' }, t(`specialtyIcons.${spec}`) + ' '),
    t('level.specialist', { spec: t(`specialties.${spec}`) }),
    who.length ? ' ' + who.map((m) => `${memberLabel(m)} (${t(`roles.${m.role}`)})`).join(', ') : '');
}

function badgeNode(level) {
  const b = BADGES[level];
  return h('div', { class: 'badge-big' },
    h('span', { class: 'badge-icon', role: 'img', 'aria-label': t(`badges.${b}.name`) }, t(`badges.${b}.icon`)),
    h('strong', {}, t(`badges.${b}.name`)));
}

function showSuccess(root, level, extra, navigate) {
  clear(root);
  const st = state.derived();
  const h1 = h('h1', { tabindex: '-1' }, '🔓 ', t('lock.successTitle', { n: level }));
  const noHints = st.noHintLevels.includes(level);
  const next = level < 4 ? h('a', { class: 'btn btn-primary', href: `#/nivell/${level + 1}` }, t('lock.nextLevel', { n: level + 1 })) : null;
  root.append(
    h1,
    h('div', { class: 'card success-card' },
      h('p', { class: 'big' }, t('lock.opened', { points: LEVEL_POINTS[level] })),
      badgeNode(level),
      noHints ? h('p', {}, h('span', { 'aria-hidden': 'true' }, t('badges.nohints.icon') + ' '), t('lock.noHintsBadge')) : null,
      level === 0 ? h('p', { class: 'code-recovered' }, t('level0.codeRecovered', { code: LEVEL0_CODE })) : null,
      level === 0 ? h('p', {}, t('level0.codeNote')) : null,
      extra || null,
      level < 4 && LEVEL_SESSION[level + 1] !== LEVEL_SESSION[level]
        ? h('p', { class: 'muted' }, t('lock.sessionEnd', { s: LEVEL_SESSION[level] })) : null,
      h('div', { class: 'btn-row' },
        level === 4 ? h('a', { class: 'btn btn-primary', href: '#/final' }, t('lock.toFinal')) : next,
        h('a', { class: 'btn', href: '#/mapa' }, t('nav.map')))
    )
  );
  h1.focus();
}

function completedCard(level, c, navigate) {
  return h('section', { class: 'card success-card' },
    h('h2', {}, '✅ ', t('level.alreadyDone')),
    badgeNode(level),
    h('p', {}, scoreSummary(level, c.score, t)),
    level === 0 ? h('p', { class: 'code-recovered' }, t('level0.codeRecovered', { code: LEVEL0_CODE })) : null,
    h('h3', {}, t('report.title')),
    h('blockquote', {}, c.report),
    h('div', { class: 'btn-row' },
      level < 4 ? h('a', { class: 'btn btn-primary', href: `#/nivell/${level + 1}` }, t('lock.nextLevel', { n: level + 1 })) : h('a', { class: 'btn btn-primary', href: '#/final' }, t('lock.toFinal')),
      h('a', { class: 'btn', href: '#/mapa' }, t('nav.map')))
  );
}

// --- Targetes Firewall (pistes) -------------------------------------------------
function hintsPanel(level) {
  const box = h('aside', { class: 'card hints', 'aria-labelledby': `hints-h-${level}` });
  const render = () => {
    const used = state.derived().hints[level];
    clear(box).append(
      h('h2', { id: `hints-h-${level}` }, '🛡 ', t('hints.title')),
      h('p', { class: 'muted small' }, t('hints.explain', { cost: HINT_COST }))
    );
    for (let n = 1; n <= HINTS_PER_LEVEL; n++) {
      const text = t(`level${level}.hints.${n - 1}`);
      if (used.includes(n)) {
        const p = h('p', {}, text);
        box.append(h('div', { class: 'hint-card open' },
          h('div', { class: 'hint-head' }, h('strong', {}, t('hints.card', { n })), speakButton(p, t('hints.card', { n }))), p));
      } else {
        const canOpen = n === 1 || used.includes(n - 1);
        const btn = h('button', { type: 'button', class: 'btn hint-btn', disabled: !canOpen },
          h('span', { 'aria-hidden': 'true' }, '🛡 '), t('hints.use', { n, cost: HINT_COST }));
        btn.addEventListener('click', async () => {
          const ok = await dialog({ title: t('hints.confirmTitle'), body: t('hints.confirmBody', { cost: HINT_COST }), confirmText: t('hints.confirmYes') });
          if (!ok) return;
          await state.append('hint_used', { level, hint: n });
          render();
          announce(t('hints.opened', { n }));
          box.querySelectorAll('.hint-card')[n - 1]?.setAttribute('tabindex', '-1');
          box.querySelectorAll('.hint-card')[n - 1]?.focus();
        });
        box.append(h('div', { class: 'hint-card closed' }, btn, !canOpen ? h('p', { class: 'muted small' }, t('hints.locked')) : null));
      }
    }
  };
  render();
  return box;
}

/** Fragment de feedback amb icona + text (mai només color). */
export function feedback(ok, text) {
  return h('p', { class: 'feedback ' + (ok ? 'ok' : 'ko') }, h('span', { 'aria-hidden': 'true' }, ok ? '✔ ' : '✖ '),
    h('span', { class: 'sr-only' }, ok ? t('feedback.correct') + ': ' : t('feedback.incorrect') + ': '), text);
}
