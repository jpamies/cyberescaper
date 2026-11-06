// Nivell 3 · Identitat digital i verificació en dos passos
import { t } from '../i18n.js';
import { h, clear, announce, loadScript } from '../ui.js';
import { renderLevel, feedback } from './common.js';
import { LEVEL3_ITEMS, LEVEL3_MIN, MEASURES, LEVEL3_STEPS, LEVEL3_SHUFFLED, RECOVERY_CODES } from './data.js';
import { totp, verifyTotp, secondsLeft, otpauthUri, PERIOD } from '../totp.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Il·lustracions de les publicacions (SVG senzills, sense fotos reals)
const PICS = {
  school: () => `<svg viewBox="0 0 200 150" focusable="false" aria-hidden="true"><rect width="200" height="150" fill="#bfdbfe"/><circle cx="100" cy="48" r="24" fill="#f1c27d"/><path d="M60 150 v-50 q40 -25 80 0 v50z" fill="#1e3a8a"/><rect x="62" y="103" width="76" height="18" fill="#fff"/><text x="100" y="116" font-size="10" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#1e3a8a">INS EXEMPLE</text></svg>`,
  location: () => `<svg viewBox="0 0 200 150" focusable="false" aria-hidden="true"><rect width="200" height="150" fill="#e5e7eb"/><path d="M0 100 h200 M60 0 v150 M140 0 v150" stroke="#fff" stroke-width="12"/><path d="M100 30 a22 22 0 0 1 22 22 c0 18 -22 44 -22 44 s-22 -26 -22 -44 a22 22 0 0 1 22 -22z" fill="#dc2626"/><circle cx="100" cy="52" r="8" fill="#fff"/></svg>`,
  pet: () => `<svg viewBox="0 0 200 150" focusable="false" aria-hidden="true"><rect width="200" height="150" fill="#fde68a"/><ellipse cx="100" cy="100" rx="50" ry="34" fill="#a16207"/><circle cx="100" cy="62" r="30" fill="#a16207"/><ellipse cx="74" cy="56" rx="10" ry="20" fill="#713f12"/><ellipse cx="126" cy="56" rx="10" ry="20" fill="#713f12"/><circle cx="90" cy="60" r="4"/><circle cx="110" cy="60" r="4"/><ellipse cx="100" cy="74" rx="7" ry="5"/></svg>`,
  street: () => `<svg viewBox="0 0 200 150" focusable="false" aria-hidden="true"><rect width="200" height="150" fill="#d6d3d1"/><rect x="70" y="40" width="60" height="110" fill="#78350f"/><circle cx="120" cy="96" r="4" fill="#fbbf24"/><rect x="20" y="14" width="160" height="22" rx="3" fill="#1e40af"/><text x="100" y="30" font-size="12" fill="#fff" text-anchor="middle" font-family="sans-serif">C/ de l'Exemple, 23</text><rect x="86" y="50" width="28" height="18" fill="#fff"/><text x="100" y="64" font-size="13" text-anchor="middle" font-family="sans-serif" font-weight="bold">23</text></svg>`,
  ticket: () => `<svg viewBox="0 0 200 150" focusable="false" aria-hidden="true"><rect width="200" height="150" fill="#cffafe"/><rect x="20" y="30" width="160" height="90" rx="8" fill="#fff" stroke="#0e7490" stroke-width="2"/><text x="32" y="52" font-size="11" font-family="sans-serif" font-weight="bold" fill="#0e7490">BITLLET · BCN → PAR</text><text x="32" y="74" font-size="10" font-family="sans-serif">27/11 · 08:15 · 14B</text><text x="32" y="100" font-size="14" font-family="monospace" font-weight="bold">X7K29Q</text><rect x="140" y="62" width="30" height="44" fill="#0f172a"/></svg>`
};

function profileAvatar() {
  return `<svg viewBox="0 0 80 80" focusable="false" aria-hidden="true"><circle cx="40" cy="40" r="40" fill="#f9a8d4"/><circle cx="40" cy="32" r="14" fill="#f1c27d"/><path d="M14 70 q26 -26 52 0" fill="#7c3aed"/><path d="M24 30 q16 -26 32 0 q-4 -10 -16 -10 q-12 0 -16 10z" fill="#3f2a14"/></svg>`;
}

export function render(root, ctx) {
  let totpTimer = null;
  renderLevel(root, 3, {
    body(draft, save) {
      draft.items ??= {};
      draft.distractors ??= [];
      draft.order ??= [...LEVEL3_SHUFFLED];
      draft.stepsAttempts ??= 0;

      // ---------------- Part A ----------------
      const found = h('div', { class: 'found-list' });
      const counter = h('p', { class: 'counter-big', 'aria-live': 'polite' });
      const lastFb = h('div', { role: 'status', 'aria-live': 'polite' });
      const itemBtns = {};

      const updateCount = () => {
        const prot = LEVEL3_ITEMS.filter((it) => it.risk && it.ok.includes(draft.items[it.id])).length;
        counter.textContent = t('level3.counter', { found: Object.keys(draft.items).length, protected: prot });
      };

      const renderFound = () => {
        clear(found);
        if (!Object.keys(draft.items).length) found.append(h('p', { class: 'muted' }, t('level3.noneFound')));
        for (const it of LEVEL3_ITEMS.filter((x) => x.id in draft.items)) {
          const sel = h('select', { id: `l3-m-${it.id}` },
            h('option', { value: '' }, t('level3.chooseMeasure')),
            MEASURES.map((m) => h('option', { value: m, selected: draft.items[it.id] === m }, t(`level3.measures.${m}`))));
          const fb = h('div', { 'aria-live': 'polite' });
          const showFb = () => {
            clear(fb);
            const m = draft.items[it.id];
            if (!m) return;
            fb.append(it.ok.includes(m) ? feedback(true, t(`level3.items.${it.id}.why`)) : feedback(false, t('level3.measureKo')));
          };
          sel.addEventListener('change', () => { draft.items[it.id] = sel.value || null; save(); showFb(); updateCount(); });
          showFb();
          found.append(h('div', { class: 'found-row' },
            h('label', { for: `l3-m-${it.id}` }, h('span', { 'aria-hidden': 'true' }, '⚠ '), h('strong', {}, t(`level3.items.${it.id}.label`))),
            sel, fb));
        }
      };

      const item = (id, content, cls = 'seg') => {
        const it = LEVEL3_ITEMS.find((x) => x.id === id);
        const btn = h('button', { type: 'button', class: `${cls} l3-item`, dataset: { item: id }, 'aria-pressed': String(id in draft.items || draft.distractors.includes(id)) }, content);
        btn.addEventListener('click', () => {
          if (it.risk) {
            if (!(id in draft.items)) draft.items[id] = null;
            clear(lastFb).append(feedback(true, t('level3.foundOne', { what: t(`level3.items.${id}.label`) })));
            save(); renderFound(); updateCount();
            document.getElementById(`l3-m-${id}`)?.focus();
          } else {
            if (!draft.distractors.includes(id)) draft.distractors.push(id);
            clear(lastFb).append(h('p', { class: 'feedback neutral' }, h('span', { 'aria-hidden': 'true' }, '🙂 '), t(`level3.items.${id}.why`)));
            save();
          }
          btn.setAttribute('aria-pressed', 'true');
        });
        itemBtns[id] = btn;
        return btn;
      };

      const pic = (id, picKey) => {
        const b = item(id, '', 'pic-btn');
        b.innerHTML = PICS[picKey]();
        b.append(h('span', { class: 'sr-only' }, t(`level3.pics.${picKey}`)));
        return b;
      };
      const staticPic = (picKey) => {
        const d = h('div', { class: 'pic', role: 'img', 'aria-label': t(`level3.pics.${picKey}`) });
        d.innerHTML = PICS[picKey]();
        return d;
      };

      const post = (n, media, caption) => h('article', { class: 'post', 'aria-label': t('level3.postN', { n }) }, media, h('p', { class: 'caption' }, caption),
        h('p', { class: 'post-meta', 'aria-hidden': 'true' }, '❤ ', String(20 + n * 7)));

      const avatar = h('div', { class: 'profile-avatar', role: 'img', 'aria-label': t('level3.avatarAlt') });
      avatar.innerHTML = profileAvatar();
      const profile = h('section', { class: 'profile', 'aria-label': t('level3.profileLabel') },
        h('header', { class: 'profile-head' }, avatar,
          h('div', {}, h('p', { class: 'profile-name' }, t('level3.profileName')), h('p', { class: 'muted' }, '@laia.ex · ', t('level3.publicProfile')),
            h('p', { class: 'bio' },
              item('birth', '🎂 12/03/2011'), ' ',
              item('phone', '📞 +44 7700 900315'), ' ',
              item('hobby', t('level3.bioHobby'))))),
        h('div', { class: 'posts' },
          post(1, pic('school', 'school'), item('firstday', t('level3.captions.p1'))),
          post(2, staticPic('location'), item('location', t('level3.captions.p2'))),
          post(3, staticPic('pet'), item('pet', t('level3.captions.p3'))),
          post(4, pic('street', 'street'), t('level3.captions.p4')),
          post(5, h('div', { class: 'pic text-post', 'aria-hidden': 'true' }, '🏀'), item('schedule', t('level3.captions.p5'))),
          post(6, pic('ticket', 'ticket'), t('level3.captions.p6'))
        )
      );

      const partA = h('section', { class: 'card', 'aria-labelledby': 'l3a-h' },
        h('h2', { id: 'l3a-h' }, t('level3.partA')),
        h('p', {}, t('level3.partAHelp')),
        profile, lastFb, counter,
        h('h3', {}, t('level3.foundTitle')), found);
      renderFound(); updateCount();

      // ---------------- Part B ----------------
      const list = h('ol', { class: 'order-list', 'aria-describedby': 'l3-order-help' });
      const orderFb = h('div', { role: 'status', 'aria-live': 'polite' });
      const authBox = h('div', {});
      let dragId = null;
      const move = (i, d) => {
        const j = i + d;
        if (j < 0 || j >= draft.order.length) return;
        [draft.order[i], draft.order[j]] = [draft.order[j], draft.order[i]];
        save(); renderOrder();
        list.children[j]?.querySelector(d < 0 ? '.up' : '.down')?.focus() || list.children[j]?.querySelector('button')?.focus();
        announce(t('level3.moved', { step: t(`level3.steps.${draft.order[j]}`), pos: j + 1 }));
      };
      const renderOrder = () => {
        clear(list);
        draft.order.forEach((id, i) => {
          const li = h('li', { class: 'order-item', draggable: draft.stepsOk ? 'false' : 'true', dataset: { id } },
            h('span', { class: 'grip', 'aria-hidden': 'true' }, '⠿'),
            h('span', { class: 'order-text' }, t(`level3.steps.${id}`)),
            draft.stepsOk ? null : h('span', { class: 'order-btns' },
              h('button', { type: 'button', class: 'btn btn-small up', disabled: i === 0, onclick: () => move(i, -1) },
                h('span', { 'aria-hidden': 'true' }, '↑'), h('span', { class: 'sr-only' }, t('level3.up', { step: t(`level3.steps.${id}`) }))),
              h('button', { type: 'button', class: 'btn btn-small down', disabled: i === draft.order.length - 1, onclick: () => move(i, 1) },
                h('span', { 'aria-hidden': 'true' }, '↓'), h('span', { class: 'sr-only' }, t('level3.down', { step: t(`level3.steps.${id}`) }))))
          );
          li.addEventListener('dragstart', (e) => { dragId = id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); li.classList.add('dragging'); });
          li.addEventListener('dragend', () => li.classList.remove('dragging'));
          li.addEventListener('dragover', (e) => { e.preventDefault(); li.classList.add('drop-target'); });
          li.addEventListener('dragleave', () => li.classList.remove('drop-target'));
          li.addEventListener('drop', (e) => {
            e.preventDefault();
            li.classList.remove('drop-target');
            const from = draft.order.indexOf(dragId);
            const to = draft.order.indexOf(id);
            if (from < 0 || from === to) return;
            draft.order.splice(to, 0, draft.order.splice(from, 1)[0]);
            save(); renderOrder();
          });
          list.append(li);
        });
      };
      renderOrder();

      const checkOrder = h('button', { type: 'button', class: 'btn btn-primary', hidden: Boolean(draft.stepsOk) }, t('level3.checkOrder'));
      checkOrder.addEventListener('click', () => {
        draft.stepsAttempts++;
        const ok = draft.order.every((id, i) => id === LEVEL3_STEPS[i]);
        const right = draft.order.filter((id, i) => id === LEVEL3_STEPS[i]).length;
        if (ok) { draft.stepsOk = true; checkOrder.hidden = true; renderOrder(); renderAuth(); }
        save();
        clear(orderFb).append(ok ? feedback(true, t('level3.orderOk')) : feedback(false, t('level3.orderKo', { n: right })));
      });

      const renderAuth = async () => {
        clear(authBox);
        if (!draft.stepsOk) return;
        const qrHolder = h('div', { class: 'qr', role: 'img', 'aria-label': t('level3.qrAlt') });
        const codeEl = h('p', { class: 'totp-code', 'aria-live': 'off' });
        const bar = h('div', { class: 'totp-bar' }, h('div', { class: 'totp-fill' }));
        const secs = h('p', { class: 'small' });
        const input = h('input', { id: 'l3-code', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '7', pattern: '[0-9 ]*' });
        const codeFb = h('div', { role: 'status', 'aria-live': 'polite' });
        const verify = h('button', { type: 'button', class: 'btn btn-primary' }, t('level3.verifyCode'));
        const recovery = h('div', {});
        const renderRecovery = () => {
          clear(recovery);
          if (!draft.totpOk) return;
          const cb = h('input', { type: 'checkbox', id: 'l3-saved', checked: Boolean(draft.saved) });
          cb.addEventListener('change', () => { draft.saved = cb.checked; save(); });
          recovery.append(h('div', { class: 'card inset' },
            h('h4', {}, '🗝 ', t('level3.recoveryTitle')),
            h('ul', { class: 'recovery' }, RECOVERY_CODES.map((c) => h('li', {}, h('code', { translate: 'no' }, c)))),
            h('p', { class: 'small' }, t('level3.recoveryHelp')),
            h('label', { for: 'l3-saved', class: 'check' }, cb, ' ', t('level3.recoverySaved'))));
        };
        verify.addEventListener('click', async () => {
          const ok = await verifyTotp(input.value);
          if (ok) { draft.totpOk = true; save(); }
          clear(codeFb).append(ok ? feedback(true, t('level3.codeOk')) : feedback(false, t('level3.codeKo')));
          renderRecovery();
        });
        authBox.append(h('div', { class: 'auth-grid' },
          h('div', { class: 'card inset' }, h('h4', {}, '⚙ ', t('level3.setupTitle')), h('p', { class: 'small' }, t('level3.setupHelp')), qrHolder),
          h('div', { class: 'auth-app' }, h('p', { class: 'auth-title' }, '📱 ', t('level3.appTitle')), h('p', { class: 'small' }, 'CyberEscaper · laia.ex'), codeEl, bar, secs,
            h('p', { class: 'muted small' }, t('level3.appNote')))
        ),
        draft.totpOk ? feedback(true, t('level3.codeOk')) : h('div', { class: 'input-row' }, h('label', { for: 'l3-code' }, t('level3.codeLabel')), input, verify),
        codeFb, recovery);
        renderRecovery();
        // QR fictici
        try {
          await loadScript('vendor/qrcode.js');
          const qr = window.qrcode(0, 'M');
          qr.addData(otpauthUri());
          qr.make();
          const n = qr.getModuleCount();
          let rects = '';
          for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) rects += `<rect x="${c + 2}" y="${r + 2}" width="1" height="1"/>`;
          qrHolder.innerHTML = `<svg viewBox="0 0 ${n + 4} ${n + 4}" focusable="false" aria-hidden="true" shape-rendering="crispEdges"><rect width="${n + 4}" height="${n + 4}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
        } catch { qrHolder.textContent = '▦'; }
        const update = async () => {
          if (!codeEl.isConnected) { clearInterval(totpTimer); return; }
          const code = await totp();
          codeEl.textContent = code.slice(0, 3) + ' ' + code.slice(3);
          const s = secondsLeft();
          secs.textContent = t('level3.changesIn', { s });
          bar.firstChild.style.width = (s / PERIOD) * 100 + '%';
        };
        clearInterval(totpTimer);
        totpTimer = setInterval(update, 1000);
        update();
      };
      renderAuth();

      const partB = h('section', { class: 'card', 'aria-labelledby': 'l3b-h' },
        h('h2', { id: 'l3b-h' }, t('level3.partB')),
        h('p', { id: 'l3-order-help' }, t('level3.partBHelp')),
        list, checkOrder, orderFb, authBox);

      return h('div', {}, partA, partB);
    },
    check(draft) {
      const prot = LEVEL3_ITEMS.filter((it) => it.risk && it.ok.includes(draft.items[it.id])).length;
      if (prot < LEVEL3_MIN) return { ok: false, reason: t('level3.lock.partA', { n: prot, min: LEVEL3_MIN }) };
      if (!draft.stepsOk) return { ok: false, reason: t('level3.lock.steps') };
      if (!draft.totpOk) return { ok: false, reason: t('level3.lock.totp') };
      if (!draft.saved) return { ok: false, reason: t('level3.lock.saved') };
      clearInterval(totpTimer);
      return {
        ok: true,
        score: {
          dataFound: LEVEL3_ITEMS.filter((it) => it.risk && it.id in draft.items).length,
          measuresOk: prot, stepsOk: true, stepsAttempts: draft.stepsAttempts, totpOk: true
        }
      };
    },
    success() {
      return h('ul', { class: 'explain-list' }, LEVEL3_ITEMS.filter((i) => i.risk).map((i) =>
        h('li', {}, h('strong', {}, t(`level3.items.${i.id}.label`)), ': ', t(`level3.items.${i.id}.why`))));
    }
  }, ctx);
}
