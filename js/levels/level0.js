// Nivell 0 · Auditoria de l'escriptori
import { t } from '../i18n.js';
import { h, clear, announce } from '../ui.js';
import { renderLevel, feedback } from './common.js';
import { LEVEL0_ZONES, LEVEL0_ANSWER } from './data.js';

// Posició de cada zona clicable dins l'escena (viewBox 1000 × 600)
const ZONE_BOX = {
  postit: [600, 30, 95, 95],
  session: [278, 88, 176, 76],
  email: [458, 88, 166, 116],
  file: [282, 172, 78, 84],
  update: [364, 206, 160, 88],
  antivirus: [530, 206, 98, 86],
  wifi: [512, 300, 118, 42],
  usb: [684, 282, 64, 54],
  plant: [62, 220, 140, 240],
  calendar: [840, 30, 145, 170]
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function sceneSvg() {
  const s = (k) => esc(t(`level0.scene.${k}`));
  return `
<svg viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="scene-title" focusable="false">
  <title id="scene-title">${s('alt')}</title>
  <rect width="1000" height="600" fill="#26344d"/>
  <rect y="400" width="1000" height="200" fill="#6b4f36"/>
  <rect y="400" width="1000" height="14" fill="#82623f"/>
  <!-- calendari (distractor) -->
  <g>
    <rect x="850" y="40" width="125" height="150" rx="6" fill="#f4f1e8"/>
    <rect x="850" y="40" width="125" height="34" rx="6" fill="#3b82f6"/>
    <text x="912" y="63" font-size="16" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="bold">${s('calendarMonth')}</text>
    <text x="912" y="92" font-size="11" text-anchor="middle" fill="#333" font-family="sans-serif">${s('calendarTitle')}</text>
    ${Array.from({ length: 20 }, (_, i) => `<rect x="${862 + (i % 5) * 21}" y="${102 + Math.floor(i / 5) * 20}" width="15" height="14" fill="${i === 7 ? '#f59e0b' : '#d7dbe3'}"/>`).join('')}
  </g>
  <!-- planta (distractor) -->
  <g>
    <path d="M95 380 h70 l-10 70 h-50 z" fill="#b45f3c"/>
    <path d="M130 380 C 100 320, 70 300, 80 250 C 115 290, 125 330, 130 380" fill="#2f9e44"/>
    <path d="M130 380 C 150 320, 190 300, 185 240 C 150 280, 140 330, 130 380" fill="#37b24d"/>
    <path d="M130 380 C 125 320, 130 280, 132 225 C 145 280, 140 330, 130 380" fill="#2b8a3e"/>
  </g>
  <!-- monitor -->
  <rect x="250" y="60" width="400" height="300" rx="14" fill="#111827"/>
  <rect x="270" y="80" width="360" height="262" fill="#1e3a8a"/>
  <rect x="420" y="360" width="60" height="40" fill="#374151"/>
  <rect x="380" y="396" width="140" height="14" rx="4" fill="#4b5563"/>
  <!-- finestra: sessió oberta -->
  <g>
    <rect x="282" y="92" width="168" height="68" rx="4" fill="#e5e7eb"/>
    <rect x="282" y="92" width="168" height="16" rx="4" fill="#9ca3af"/>
    <circle cx="300" cy="134" r="12" fill="#60a5fa"/>
    <text x="318" y="128" font-size="10" fill="#111" font-family="sans-serif">${s('sessionLine1')}</text>
    <text x="318" y="143" font-size="10" fill="#111" font-family="sans-serif">${s('sessionLine2')}</text>
  </g>
  <!-- finestra: correu amb enllaç -->
  <g>
    <rect x="462" y="92" width="158" height="108" rx="4" fill="#fff"/>
    <rect x="462" y="92" width="158" height="16" rx="4" fill="#9ca3af"/>
    <text x="468" y="104" font-size="9" fill="#111" font-family="sans-serif">✉ ${s('emailWindow')}</text>
    <text x="468" y="124" font-size="9" fill="#444" font-family="sans-serif">${s('emailFrom')}</text>
    <text x="468" y="142" font-size="11" fill="#111" font-family="sans-serif" font-weight="bold">${s('emailSubject')}</text>
    <text x="468" y="160" font-size="9" fill="#111" font-family="sans-serif">${s('emailBody')}</text>
    <rect x="468" y="170" width="92" height="20" rx="3" fill="#dc2626"/>
    <text x="514" y="184" font-size="10" fill="#fff" text-anchor="middle" font-family="sans-serif">${s('emailLink')}</text>
  </g>
  <!-- fitxer a l'escriptori -->
  <g>
    <path d="M298 180 h34 l12 12 v44 h-46 z" fill="#f8fafc"/>
    <path d="M332 180 v12 h12" fill="#cbd5e1"/>
    <text x="321" y="216" font-size="10" text-anchor="middle" fill="#334155" font-family="monospace">TXT</text>
    <text x="321" y="252" font-size="10" text-anchor="middle" fill="#fff" font-family="sans-serif">${s('fileName')}</text>
  </g>
  <!-- actualització ajornada -->
  <g>
    <rect x="368" y="210" width="152" height="80" rx="4" fill="#fef3c7"/>
    <text x="376" y="230" font-size="11" fill="#111" font-family="sans-serif" font-weight="bold">⟳ ${s('updateTitle')}</text>
    <rect x="376" y="242" width="136" height="18" rx="3" fill="#d1d5db"/>
    <text x="444" y="255" font-size="9" fill="#111" text-anchor="middle" font-family="sans-serif">${s('updateNow')}</text>
    <rect x="376" y="264" width="136" height="18" rx="3" fill="#2563eb"/>
    <text x="444" y="277" font-size="9" fill="#fff" text-anchor="middle" font-family="sans-serif">${s('updateLater')}</text>
  </g>
  <!-- avís antivirus -->
  <g>
    <rect x="534" y="210" width="90" height="78" rx="4" fill="#fee2e2"/>
    <text x="579" y="236" font-size="20" text-anchor="middle" fill="#b91c1c" font-family="sans-serif">⛨</text>
    <text x="579" y="256" font-size="9" text-anchor="middle" fill="#7f1d1d" font-family="sans-serif" font-weight="bold">${s('antivirus1')}</text>
    <text x="579" y="270" font-size="9" text-anchor="middle" fill="#7f1d1d" font-family="sans-serif">${s('antivirus2')}</text>
  </g>
  <!-- barra de tasques i Wi-Fi -->
  <rect x="270" y="318" width="360" height="24" fill="#0f172a"/>
  <rect x="278" y="323" width="14" height="14" fill="#60a5fa"/>
  <text x="560" y="334" font-size="9" fill="#fde68a" text-anchor="end" font-family="sans-serif">WiFi_Gratis · ${s('wifiOpen')}</text>
  <path d="M600 337 l-14 -12 a20 20 0 0 1 28 0 z" fill="#fde68a"/>
  <path d="M600 337 l-8 -7 a11 11 0 0 1 16 0 z" fill="#0f172a"/>
  <!-- pòsit amb contrasenya -->
  <g transform="rotate(8 648 78)">
    <rect x="610" y="40" width="78" height="72" fill="#fde047"/>
    <text x="649" y="66" font-size="11" text-anchor="middle" fill="#111" font-family="cursive, sans-serif">${s('postit1')}</text>
    <text x="649" y="84" font-size="12" text-anchor="middle" fill="#111" font-family="cursive, sans-serif" font-weight="bold">Profe1234</text>
  </g>
  <!-- torre i USB -->
  <rect x="730" y="210" width="100" height="250" rx="8" fill="#1f2937"/>
  <circle cx="780" cy="240" r="8" fill="#22c55e"/>
  <rect x="745" y="300" width="14" height="22" fill="#111"/>
  <rect x="694" y="298" width="52" height="26" rx="4" fill="#ef4444"/>
  <text x="716" y="316" font-size="14" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="bold">?</text>
  <!-- teclat i ratolí -->
  <rect x="330" y="450" width="260" height="56" rx="6" fill="#374151"/>
  ${Array.from({ length: 24 }, (_, i) => `<rect x="${340 + (i % 12) * 20}" y="${460 + Math.floor(i / 12) * 20}" width="16" height="14" rx="2" fill="#6b7280"/>`).join('')}
  <ellipse cx="640" cy="482" rx="18" ry="26" fill="#374151"/>
</svg>`;
}

export function render(root, ctx) {
  renderLevel(root, 0, {
    body(draft, save) {
      draft.found ??= [];
      draft.distractors ??= [];
      const counter = h('p', { class: 'counter-big', 'aria-live': 'polite' });
      const list = h('ol', { class: 'findings' });
      const last = h('div', { class: 'last-finding', role: 'status', 'aria-live': 'polite' });
      const scene = h('div', { class: 'scene' });
      scene.innerHTML = sceneSvg();

      const updateCounter = () => { counter.textContent = t('level0.counter', { n: draft.found.length }); };
      const renderList = () => {
        clear(list);
        draft.found.forEach((id) => list.append(h('li', {}, h('strong', {}, t(`level0.zones.${id}.label`)), ': ', t(`level0.zones.${id}.explain`))));
      };

      for (const z of LEVEL0_ZONES) {
        const [x, y, w, hh] = ZONE_BOX[z.id];
        const btn = h('button', {
          type: 'button', class: 'zone', dataset: { zone: z.id },
          style: { left: `${x / 10}%`, top: `${y / 6}%`, width: `${w / 10}%`, height: `${hh / 6}%` }
        }, h('span', { class: 'sr-only' }, t(`level0.zones.${z.id}.label`)), h('span', { class: 'zone-mark', 'aria-hidden': 'true' }));
        const mark = () => {
          const m = btn.querySelector('.zone-mark');
          if (draft.found.includes(z.id)) { btn.classList.add('found'); m.textContent = '⚠ ' + (draft.found.indexOf(z.id) + 1); }
          else if (draft.distractors.includes(z.id)) { btn.classList.add('safe'); m.textContent = '✓'; }
        };
        btn.addEventListener('click', () => {
          const label = t(`level0.zones.${z.id}.label`);
          const explain = t(`level0.zones.${z.id}.explain`);
          if (z.risk) {
            if (!draft.found.includes(z.id)) draft.found.push(z.id);
            clear(last).append(feedback(true, `${label}: ${explain}`));
          } else {
            if (!draft.distractors.includes(z.id)) draft.distractors.push(z.id);
            clear(last).append(h('p', { class: 'feedback neutral' }, h('span', { 'aria-hidden': 'true' }, '🌿 '), `${label}: ${explain}`));
          }
          save(); mark(); updateCounter(); renderList();
        });
        mark();
        scene.append(btn);
      }
      updateCounter();
      renderList();

      const input = h('input', { id: 'l0-answer', type: 'number', inputmode: 'numeric', min: '0', max: '10', value: draft.answer ?? '' });
      input.addEventListener('input', () => { draft.answer = input.value; save(); });

      return h('div', {},
        h('p', { class: 'muted small' }, t('level0.sceneHelp')),
        scene,
        counter,
        last,
        h('details', { class: 'card' }, h('summary', {}, t('level0.listTitle')), list),
        h('div', { class: 'card lock-question' },
          h('label', { for: 'l0-answer' }, '🔢 ', t('level0.question')),
          input)
      );
    },
    check(draft) {
      const n = Number(draft.answer);
      if (String(draft.answer ?? '').trim() === '') return { ok: false, reason: t('level0.needAnswer') };
      if (n !== LEVEL0_ANSWER) return { ok: false, reason: t('level0.wrong') };
      return { ok: true, score: { found: draft.found.length, distractors: draft.distractors.length } };
    }
  }, ctx);
}
