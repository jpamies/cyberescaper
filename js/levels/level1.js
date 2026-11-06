// Nivell 1 · Contrasenyes
// IMPORTANT: la contrasenya de la part B no es guarda MAI (ni a localStorage ni a la cadena).
// Només viu en memòria mentre la pàgina és oberta.
import { t } from '../i18n.js';
import { h, clear } from '../ui.js';
import { renderLevel, feedback } from './common.js';
import { LEVEL1_SAMPLES, LEVEL1_MIN_OK, STRENGTH_LEVELS } from './data.js';
import { analyze, passphraseCriteria } from '../strength.js';

let passphrase = ''; // només en memòria

export function meter(result) {
  const box = h('div', { class: 'meter-box' });
  const pct = Math.max(4, result.score);
  box.append(
    h('div', { class: `meter meter-${result.level}`, role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(result.score), 'aria-label': t('level1.checker.robustness') },
      h('div', { class: 'meter-fill', style: { width: pct + '%' } })),
    h('p', { class: 'meter-label' },
      h('span', { 'aria-hidden': 'true' }, { weak: '🔴 ', medium: '🟠 ', strong: '🟢 ' }[result.level]),
      t('level1.checker.result', { level: t(`level1.levels.${result.level}`), score: result.score, bits: result.bits }))
  );
  const pats = result.patterns.map((p) => h('li', {}, t(`level1.patterns.${p.id}`, { value: p.value ?? '' })));
  if (result.length) pats.push(h('li', {}, t('level1.patterns.classes', { n: result.classes.count })));
  box.append(h('ul', { class: 'patterns' }, pats));
  return box;
}

export function render(root, ctx) {
  renderLevel(root, 1, {
    body(draft, save) {
      draft.picks ??= {};
      // --- Part A ---
      const partA = h('section', { class: 'card', 'aria-labelledby': 'l1a-h' }, h('h2', { id: 'l1a-h' }, t('level1.partA')), h('p', {}, t('level1.partAHelp')));
      const rows = h('div', { class: 'classify' });
      for (const s of LEVEL1_SAMPLES) {
        const name = `l1-${s.id}`;
        const fs = h('fieldset', { class: 'classify-row', dataset: { id: s.id } },
          h('legend', {}, h('code', { class: 'pw', translate: 'no' }, s.password)),
          h('div', { class: 'radio-row' }, STRENGTH_LEVELS.map((lv) => {
            const id = `${name}-${lv}`;
            const input = h('input', { type: 'radio', name, id, value: lv, checked: draft.picks[s.id] === lv });
            input.addEventListener('change', () => { draft.picks[s.id] = lv; save(); fs.querySelector('.row-fb')?.remove(); });
            return h('label', { for: id, class: 'chip' }, input, ' ', t(`level1.levels.${lv}`));
          }))
        );
        rows.append(fs);
      }
      partA.append(rows);

      // comprovador
      const tester = h('input', { id: 'l1-tester', type: 'text', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off' });
      const testOut = h('div', { 'aria-live': 'polite' });
      tester.addEventListener('input', () => { clear(testOut); if (tester.value) testOut.append(meter(analyze(tester.value))); });
      partA.append(h('div', { class: 'card inset' },
        h('h3', {}, '🧪 ', t('level1.checker.title')),
        h('p', { class: 'muted small' }, t('level1.checker.note')),
        h('label', { for: 'l1-tester' }, t('level1.checker.label')), tester, testOut,
        h('div', { class: 'btn-row' }, LEVEL1_SAMPLES.map((s) => h('button', {
          type: 'button', class: 'btn btn-small', onclick: () => { tester.value = s.password; tester.dispatchEvent(new Event('input')); tester.focus(); }
        }, t('level1.checker.try', { pw: s.password }))))
      ));

      // --- Part B ---
      const pp = h('input', { id: 'l1-pass', type: 'password', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off', 'aria-describedby': 'l1-crit' });
      pp.value = passphrase;
      const crit = h('ul', { id: 'l1-crit', class: 'criteria', 'aria-live': 'polite' });
      const ppMeter = h('div', {});
      const show = h('button', { type: 'button', class: 'btn btn-small', 'aria-pressed': 'false' }, t('level1.show'));
      show.addEventListener('click', () => {
        const visible = pp.type === 'password';
        pp.type = visible ? 'text' : 'password';
        show.setAttribute('aria-pressed', String(visible));
        show.textContent = visible ? t('level1.hide') : t('level1.show');
      });
      const updatePP = () => {
        passphrase = pp.value;
        const c = passphraseCriteria(pp.value);
        clear(crit);
        for (const k of ['length', 'words', 'numberOrSymbol']) {
          crit.append(h('li', { class: c[k] ? 'ok' : 'ko' }, h('span', { 'aria-hidden': 'true' }, c[k] ? '✔ ' : '✖ '),
            h('span', { class: 'sr-only' }, c[k] ? t('feedback.met') + ': ' : t('feedback.notMet') + ': '), t(`level1.criteria.${k}`)));
        }
        clear(ppMeter);
        if (pp.value) ppMeter.append(meter(analyze(pp.value)));
      };
      pp.addEventListener('input', updatePP);
      updatePP();

      const partB = h('section', { class: 'card', 'aria-labelledby': 'l1b-h' },
        h('h2', { id: 'l1b-h' }, t('level1.partB')),
        h('p', {}, t('level1.method')),
        h('p', { class: 'warning strong' }, h('span', { 'aria-hidden': 'true' }, '⚠ '), t('level1.noReal')),
        h('label', { for: 'l1-pass' }, t('level1.passLabel')),
        h('div', { class: 'input-row' }, pp, show),
        crit, ppMeter
      );
      return h('div', {}, partA, partB);
    },
    check(draft) {
      const missing = LEVEL1_SAMPLES.some((s) => !draft.picks[s.id]);
      if (missing) return { ok: false, reason: t('level1.needAll') };
      let ok = 0;
      for (const s of LEVEL1_SAMPLES) {
        const right = draft.picks[s.id] === s.answer;
        if (right) ok++;
        const fs = document.querySelector(`.classify-row[data-id="${s.id}"]`);
        fs?.querySelector('.row-fb')?.remove();
        fs?.append(h('div', { class: 'row-fb' }, feedback(right, right ? t('level1.rowOk') : t('level1.rowKo'))));
      }
      if (ok < LEVEL1_MIN_OK) return { ok: false, reason: t('level1.notEnough', { n: ok, min: LEVEL1_MIN_OK }) };
      const c = passphraseCriteria(passphrase);
      if (!c.ok) return { ok: false, reason: t('level1.ppNotOk') };
      const score = { classification: ok, passphraseOk: true, passphraseLength: [...passphrase].length };
      return { ok: true, score };
    },
    reportGuard(text) {
      if (passphrase && passphrase.length >= 4 && text.includes(passphrase)) return t('level1.reportHasPass');
      return null;
    },
    success() {
      const list = h('ul', { class: 'explain-list' }, LEVEL1_SAMPLES.map((s) =>
        h('li', {}, h('code', { translate: 'no' }, s.password), ' — ', h('strong', {}, t(`level1.levels.${s.answer}`)), ': ', t(`level1.explain.${s.id}`))));
      passphrase = '';
      return h('div', {}, h('h3', {}, t('level1.explainTitle')), list, h('p', { class: 'muted' }, t('level1.forgotten')));
    }
  }, ctx);
}
