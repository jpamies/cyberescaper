// Nivell 4 · Xifratge i cadena de confiança
import { t } from '../i18n.js';
import { h, clear, announce } from '../ui.js';
import { renderLevel, feedback } from './common.js';
import { LEVEL4_QUIZ, LEVEL4_QUIZ_OK } from './data.js';
import { ALPHABET, encrypt, sameText } from '../caesar.js';
import { LEVEL0_CODE } from '../derive.js';
import { verifyChain } from '../chain.js';
import { chainCards } from '../chainview.js';
import * as state from '../state.js';

const STEP = 360 / 26;

function wheelSvg() {
  const R1 = 140, R2 = 102, C = 160;
  const pos = (r, i) => {
    const a = (i * STEP - 90) * Math.PI / 180;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };
  const ring = (r, cls) => [...ALPHABET].map((ch, i) => {
    const [x, y] = pos(r, i);
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="${cls}" text-anchor="middle" dominant-baseline="central" transform="rotate(${(i * STEP).toFixed(2)} ${x.toFixed(1)} ${y.toFixed(1)})">${ch}</text>`;
  }).join('');
  return `<svg viewBox="0 0 320 320" focusable="false" aria-hidden="true">
    <circle cx="${C}" cy="${C}" r="158" class="w-outer"/>
    <circle cx="${C}" cy="${C}" r="121" class="w-inner"/>
    <circle cx="${C}" cy="${C}" r="80" class="w-core"/>
    ${ring(R1, 'w-plain')}
    <g class="w-rot">${ring(R2, 'w-cipher')}</g>
    <path d="M${C} 2 l-8 -0 l8 14 l8 -14z" class="w-mark"/>
    <text x="${C}" y="${C - 8}" text-anchor="middle" class="w-label">A → <tspan class="w-shift-letter">A</tspan></text>
    <text x="${C}" y="${C + 18}" text-anchor="middle" class="w-label small w-shift-num">0</text>
  </svg>`;
}

export function render(root, ctx) {
  renderLevel(root, 4, {
    body(draft, save) {
      draft.shift ??= 0;
      const plain = t('level4.plain');
      const reply = t('level4.reply');
      const cipherText = encrypt(plain, LEVEL0_CODE);

      // ---------------- Roda de Cèsar ----------------
      const wheel = h('div', { class: 'wheel', tabindex: '0', role: 'slider', 'aria-valuemin': '0', 'aria-valuemax': '25', 'aria-label': t('level4.wheel') });
      wheel.innerHTML = wheelSvg();
      const mapping = h('p', { class: 'mapping', 'aria-live': 'polite' });
      const setShift = (s) => {
        draft.shift = ((s % 26) + 26) % 26; save();
        wheel.querySelector('.w-rot').style.transform = `rotate(${-draft.shift * STEP}deg)`;
        wheel.querySelector('.w-shift-letter').textContent = ALPHABET[draft.shift];
        wheel.querySelector('.w-shift-num').textContent = t('level4.shift', { n: draft.shift });
        wheel.setAttribute('aria-valuenow', String(draft.shift));
        wheel.setAttribute('aria-valuetext', t('level4.shiftText', { n: draft.shift, letter: ALPHABET[draft.shift] }));
        mapping.textContent = [...ALPHABET].map((c, i) => `${c}→${ALPHABET[(i + draft.shift) % 26]}`).join('  ');
      };
      wheel.addEventListener('keydown', (e) => {
        if (['ArrowRight', 'ArrowUp'].includes(e.key)) { e.preventDefault(); setShift(draft.shift + 1); }
        if (['ArrowLeft', 'ArrowDown'].includes(e.key)) { e.preventDefault(); setShift(draft.shift - 1); }
        if (e.key === 'Home') { e.preventDefault(); setShift(0); }
      });
      const wheelBox = h('div', { class: 'card inset wheel-box' },
        h('h3', {}, '🎡 ', t('level4.wheel')),
        h('p', { class: 'small muted' }, t('level4.wheelHelp')),
        wheel,
        h('div', { class: 'btn-row center' },
          h('button', { type: 'button', class: 'btn', onclick: () => setShift(draft.shift - 1) }, '◀ ', t('level4.rotLeft')),
          h('button', { type: 'button', class: 'btn', onclick: () => setShift(draft.shift + 1) }, t('level4.rotRight'), ' ▶')),
        h('p', { class: 'small' }, h('strong', {}, t('level4.mappingTitle')), ' '), mapping);
      setShift(draft.shift);

      // ---------------- Part A ----------------
      const ansA = h('input', { id: 'l4-a', type: 'text', autocomplete: 'off', spellcheck: 'false', value: draft.a || '' });
      const fbA = h('div', { role: 'status', 'aria-live': 'polite' });
      ansA.addEventListener('input', () => { draft.a = ansA.value; save(); });
      const btnA = h('button', { type: 'button', class: 'btn btn-primary' }, t('level4.check'));
      btnA.addEventListener('click', () => {
        draft.decryptOk = sameText(ansA.value, plain); save();
        clear(fbA).append(draft.decryptOk ? feedback(true, t('level4.decryptOk')) : feedback(false, t('level4.decryptKo')));
      });
      const partA = h('section', { class: 'card', 'aria-labelledby': 'l4a-h' },
        h('h2', { id: 'l4a-h' }, t('level4.partA')),
        h('p', {}, t('level4.partAHelp')),
        h('p', { class: 'label' }, t('level4.intercepted')),
        h('p', { class: 'cipher', translate: 'no' }, cipherText),
        wheelBox,
        h('label', { for: 'l4-a' }, t('level4.answerA')),
        h('div', { class: 'input-row' }, ansA, btnA), fbA);
      if (draft.decryptOk) fbA.append(feedback(true, t('level4.decryptOk')));

      // ---------------- Part B ----------------
      const ansB = h('input', { id: 'l4-b', type: 'text', autocomplete: 'off', spellcheck: 'false', value: draft.b || '' });
      const fbB = h('div', { role: 'status', 'aria-live': 'polite' });
      ansB.addEventListener('input', () => { draft.b = ansB.value; save(); });
      const btnB = h('button', { type: 'button', class: 'btn btn-primary' }, t('level4.check'));
      btnB.addEventListener('click', () => {
        draft.encryptOk = sameText(ansB.value, encrypt(reply, LEVEL0_CODE)); save();
        clear(fbB).append(draft.encryptOk ? feedback(true, t('level4.encryptOk')) : feedback(false, t('level4.encryptKo')));
      });
      const partB = h('section', { class: 'card', 'aria-labelledby': 'l4b-h' },
        h('h2', { id: 'l4b-h' }, t('level4.partB')),
        h('p', {}, t('level4.partBHelp', { reply })),
        h('label', { for: 'l4-b' }, t('level4.answerB')),
        h('div', { class: 'input-row' }, ansB, btnB), fbB);
      if (draft.encryptOk) fbB.append(feedback(true, t('level4.encryptOk')));

      // ---------------- Part C ----------------
      const original = state.getChain();
      let copy = null;
      const origBox = h('div', {});
      const copyBox = h('div', {});
      const fbC = h('div', { role: 'status', 'aria-live': 'polite' });
      verifyChain(original).then((b) => {
        clear(origBox).append(b === -1 ? feedback(true, t('level4.originalOk', { n: original.length })) : feedback(false, t('level4.originalKo', { n: b })),
          h('details', {}, h('summary', {}, t('level4.showOriginal')), chainCards(original, { brokenFrom: b })));
      });
      const renderCopy = (brokenFrom = null) => {
        clear(copyBox);
        if (!copy) return;
        copyBox.append(
          h('p', { class: 'small' }, t('level4.copyHelp')),
          chainCards(copy, {
            brokenFrom, editable: true,
            onEdit: (i, k, v) => { copy[i].data[k] = v; draft.edited = true; save(); announce(t('level4.edited', { n: i, field: k })); }
          }));
      };
      const copyBtn = h('button', { type: 'button', class: 'btn' }, '📄 ', t('level4.makeCopy'));
      copyBtn.addEventListener('click', () => { copy = structuredClone(state.getChain()); draft.edited = false; renderCopy(); clear(fbC); copyBox.querySelector('input')?.focus(); });
      const verifyBtn = h('button', { type: 'button', class: 'btn btn-primary' }, '🔍 ', t('level4.verify'));
      verifyBtn.addEventListener('click', async () => {
        if (!copy) { clear(fbC).append(feedback(false, t('level4.needCopy'))); return; }
        const b = await verifyChain(copy);
        renderCopy(b);
        if (b === -1) clear(fbC).append(feedback(true, t('level4.copyIntact')), h('p', { class: 'small' }, t('level4.tryEdit')));
        else {
          draft.tamperDetected = true; save();
          clear(fbC).append(h('p', { class: 'feedback ko' }, h('span', { 'aria-hidden': 'true' }, '⛓ '), t('level4.copyBroken', { n: b })),
            h('p', { class: 'small' }, t('level4.originalSafe')));
        }
      });

      const quiz = h('fieldset', { class: 'quiz' }, h('legend', {}, t('level4.quizQ')),
        LEVEL4_QUIZ.map((o) => {
          const id = `l4-q-${o}`;
          const r = h('input', { type: 'radio', name: 'l4-quiz', id, value: o, checked: draft.quiz === o });
          r.addEventListener('change', () => { draft.quiz = o; save(); clear(quizFb); });
          return h('label', { for: id, class: 'check' }, r, ' ', t(`level4.quiz.${o}`));
        }));
      const quizFb = h('div', { role: 'status', 'aria-live': 'polite' });
      const quizBtn = h('button', { type: 'button', class: 'btn btn-primary' }, t('level4.check'));
      quizBtn.addEventListener('click', () => {
        const ok = draft.quiz === LEVEL4_QUIZ_OK;
        draft.quizOk = ok; save();
        clear(quizFb).append(ok ? feedback(true, t('level4.quizOk')) : feedback(false, t('level4.quizKo')));
      });

      const partC = h('section', { class: 'card', 'aria-labelledby': 'l4c-h' },
        h('h2', { id: 'l4c-h' }, t('level4.partC')),
        h('p', {}, t('level4.partCHelp')),
        origBox,
        h('div', { class: 'btn-row' }, copyBtn, verifyBtn),
        fbC, copyBox, quiz, h('div', { class: 'btn-row' }, quizBtn), quizFb);

      return h('div', {}, partA, partB, partC);
    },
    check(draft) {
      if (!draft.decryptOk) return { ok: false, reason: t('level4.lock.a') };
      if (!draft.encryptOk) return { ok: false, reason: t('level4.lock.b') };
      if (!draft.tamperDetected) return { ok: false, reason: t('level4.lock.c') };
      if (!draft.quizOk) return { ok: false, reason: t('level4.lock.quiz') };
      return { ok: true, score: { decryptOk: true, encryptOk: true, tamperDetected: true, quizOk: true } };
    }
  }, ctx);
}
