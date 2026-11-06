// Nivell 2 · Caça del phishing (bústia multicanal)
import { t } from '../i18n.js';
import { h, clear, announce, dialog } from '../ui.js';
import { speakButton } from '../tts.js';
import { renderLevel, feedback } from './common.js';
import { MESSAGES, CHANNELS, ACTIONS, BAD_ACTIONS, markables, realClues, PASS_CORRECT, MIN_CLUES } from './level2-data.js';

const CHANNEL_ICON = { email: '✉️', sms: '💬', whatsapp: '🗨️', instagram: '📷' };

function senderName(msg) {
  const s = msg.sender;
  if (s.nameKey) return t(s.nameKey);
  return s.name || s.number || s.handle;
}

function msgState(draft, id) {
  draft.msgs ??= {};
  draft.msgs[id] ??= { verdict: null, marks: [], actions: [], reviewed: false, first: null };
  return draft.msgs[id];
}

function evaluate(msg, ms) {
  const correct = ms.verdict === (msg.fraud ? 'fraud' : 'legit');
  const real = realClues(msg).map((c) => c.key);
  const cluesOk = ms.marks.filter((k) => real.includes(k)).length;
  const badActions = ms.actions.some((a) => BAD_ACTIONS.includes(a));
  const actionsOk = ms.actions.length > 0 && !badActions;
  const complete = correct && (!msg.fraud || (cluesOk >= MIN_CLUES && actionsOk));
  return { correct, cluesOk, badActions, actionsOk, complete };
}

export function render(root, ctx) {
  renderLevel(root, 2, {
    body(draft, save) {
      draft.tab ??= 'email';
      draft.linksClicked ??= [];
      const linkBar = h('div', { class: 'link-bar', role: 'status', 'aria-live': 'polite' }, t('level2.linkBarIdle'));
      const tabList = h('div', { class: 'tabs', role: 'tablist', 'aria-label': t('level2.phone') });
      const panel = h('div', { class: 'tabpanel', role: 'tabpanel', tabindex: '0' });
      const tabs = {};

      const pending = (ch) => MESSAGES.filter((m) => m.channel === ch && !msgState(draft, m.id).reviewed).length;
      const updateTabs = () => {
        for (const ch of CHANNELS) {
          const n = pending(ch);
          tabs[ch].querySelector('.tab-count').textContent = n ? t('level2.pending', { n }) : t('level2.done');
          tabs[ch].setAttribute('aria-selected', String(draft.tab === ch));
          tabs[ch].tabIndex = draft.tab === ch ? 0 : -1;
        }
      };

      const showLink = (url) => { linkBar.textContent = url ? '🔗 ' + t('level2.linkBar', { url }) : t('level2.linkBarIdle'); };

      const renderPart = (msg, ms, part, key, refresh) => {
        if (part.t) return document.createTextNode(t(part.t));
        if (part.link) {
          const label = part.labelKey ? t(part.labelKey) : part.label;
          const a = h('button', { type: 'button', class: part.button ? 'fake-link fake-button' : 'fake-link', 'aria-describedby': 'l2-linkbar-help' }, label);
          a.addEventListener('mouseenter', () => showLink(part.link));
          a.addEventListener('focus', () => showLink(part.link));
          a.addEventListener('touchstart', () => showLink(part.link), { passive: true });
          a.addEventListener('mouseleave', () => showLink(null));
          a.addEventListener('blur', () => showLink(null));
          a.addEventListener('click', async () => {
            draft.linksClicked.push(msg.id); save();
            await dialog({ title: t('level2.trapTitle'), body: t('level2.trapBody', { url: part.link }), confirmText: t('level2.trapOk'), danger: true, alertOnly: true });
          });
          const flag = markToggle(ms, key, t('level2.markLink'), refresh);
          return h('span', { class: 'link-wrap' }, a, flag);
        }
        const text = part.m ? t(part.m) : part.lit;
        const btn = h('button', { type: 'button', class: 'seg', dataset: { key }, 'aria-pressed': String(ms.marks.includes(key)) },
          h('span', { class: 'flag', 'aria-hidden': 'true' }, '🚩'), text);
        btn.addEventListener('click', () => { toggleMark(ms, key); save(); btn.setAttribute('aria-pressed', String(ms.marks.includes(key))); refresh(); });
        return btn;
      };

      const toggleMark = (ms, key) => {
        const i = ms.marks.indexOf(key);
        if (i >= 0) ms.marks.splice(i, 1); else ms.marks.push(key);
      };

      const markToggle = (ms, key, label, refresh) => {
        const b = h('button', { type: 'button', class: 'flag-btn', dataset: { key }, 'aria-pressed': String(ms.marks.includes(key)) },
          h('span', { 'aria-hidden': 'true' }, '🚩'), h('span', { class: 'sr-only' }, label));
        b.title = label;
        b.addEventListener('click', () => { toggleMark(ms, key); save(); b.setAttribute('aria-pressed', String(ms.marks.includes(key))); refresh(); });
        return b;
      };

      const renderMessage = (msg) => {
        const ms = msgState(draft, msg.id);
        const card = h('article', { class: `msg msg-${msg.channel}`, 'aria-labelledby': `msg-${msg.id}-h`, dataset: { msg: String(msg.id) } });
        const markCount = h('p', { class: 'mark-count' });
        const fb = h('div', { class: 'msg-feedback', role: 'status', 'aria-live': 'polite' });
        const refresh = () => { markCount.textContent = t('level2.marked', { n: ms.marks.length }); };

        // capçalera amb remitent
        const detailId = `msg-${msg.id}-sender`;
        const details = h('div', { class: 'sender-detail', id: detailId, hidden: true },
          h('p', {}, h('strong', {}, t('level2.sender.title'))),
          msg.sender.address ? h('p', {}, t('level2.sender.address'), ': ', h('code', { translate: 'no' }, msg.sender.address)) : null,
          msg.sender.number ? h('p', {}, t('level2.sender.number'), ': ', h('code', { translate: 'no' }, msg.sender.number)) : null,
          msg.sender.handle ? h('p', {}, t('level2.sender.handle'), ': ', h('code', { translate: 'no' }, msg.sender.handle)) : null,
          (msg.sender.infoKeys || []).map((k) => h('p', {}, '• ', t(k))),
          h('p', {}, markToggle(ms, 'sender', t('level2.markSender'), refresh), ' ', t('level2.markSender'))
        );
        const senderBtn = h('button', { type: 'button', class: 'sender-btn', 'aria-expanded': 'false', 'aria-controls': detailId },
          h('span', { 'aria-hidden': 'true' }, msg.channel === 'email' ? '👤 ' : msg.channel === 'instagram' ? '◎ ' : '📱 '), senderName(msg),
          h('span', { class: 'sr-only' }, ' — ' + t('level2.sender.show')));
        senderBtn.addEventListener('click', () => {
          const open = details.hidden;
          details.hidden = !open;
          senderBtn.setAttribute('aria-expanded', String(open));
        });

        const content = h('div', { class: 'msg-content' });
        if (msg.subject) content.append(h('p', { class: 'subject' }, h('span', { class: 'muted' }, t('level2.subject'), ': '), renderPart(msg, ms, msg.subject, 'subject', refresh)));
        msg.body.forEach((para, pi) => {
          const p = h(msg.channel === 'email' ? 'p' : 'div', { class: msg.channel === 'email' ? 'para' : 'bubble' });
          para.forEach((part, i) => p.append(renderPart(msg, ms, part, `b${pi}.${i}`, refresh)));
          content.append(p);
        });

        // veredicte
        const verdictRow = h('div', { class: 'verdict', role: 'group', 'aria-label': t('level2.question') });
        const actionsBox = h('fieldset', { class: 'actions-box', hidden: ms.verdict !== 'fraud' },
          h('legend', {}, t('level2.actionsQ')),
          ACTIONS.map((a) => {
            const id = `m${msg.id}-${a}`;
            const cb = h('input', { type: 'checkbox', id, checked: ms.actions.includes(a) });
            cb.addEventListener('change', () => {
              ms.actions = cb.checked ? [...new Set([...ms.actions, a])] : ms.actions.filter((x) => x !== a);
              save();
            });
            return h('label', { for: id, class: 'check' }, cb, ' ', t(`level2.actions.${a}`));
          })
        );
        const vbtn = (v, icon) => {
          const b = h('button', { type: 'button', class: 'btn verdict-btn', 'aria-pressed': String(ms.verdict === v) }, h('span', { 'aria-hidden': 'true' }, icon + ' '), t(`level2.${v}`));
          b.addEventListener('click', () => {
            ms.verdict = v; save();
            verdictRow.querySelectorAll('.verdict-btn').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
            actionsBox.hidden = v !== 'fraud';
          });
          return b;
        };
        verdictRow.append(h('span', { class: 'q' }, t('level2.question')), vbtn('fraud', '🚨'), vbtn('legit', '✅'));

        const review = h('button', { type: 'button', class: 'btn btn-primary' }, t('level2.review'));
        const showFeedback = () => {
          const ev = evaluate(msg, ms);
          clear(fb);
          if (ev.correct) fb.append(feedback(true, msg.fraud ? t('level2.fb.correctFraud') : t('level2.fb.correctLegit')));
          else fb.append(feedback(false, msg.fraud ? t('level2.fb.wrongFraud') : t('level2.fb.wrongLegit')));
          if (ev.correct && msg.fraud) {
            if (ev.cluesOk < MIN_CLUES) fb.append(feedback(false, t('level2.fb.needClues', { n: ev.cluesOk, min: MIN_CLUES })));
            else fb.append(feedback(true, t('level2.fb.cluesOk', { n: ev.cluesOk })));
            if (ms.actions.length === 0) fb.append(feedback(false, t('level2.fb.needAction')));
            else if (ev.badActions) fb.append(feedback(false, t('level2.fb.badAction')));
          }
          const wrongMarks = ms.marks.filter((k) => !realClues(msg).some((c) => c.key === k));
          if (wrongMarks.length && ev.correct) fb.append(h('p', { class: 'muted small' }, t('level2.fb.notClues', { n: wrongMarks.length })));
          if (ev.correct) {
            if (msg.fraud) fb.append(h('p', { class: 'small' }, h('strong', {}, t('level2.fb.realClues')), ' ', [...new Set(realClues(msg).map((c) => t(`level2.clue.${c.clue}`)))].join(' · ')));
            fb.append(h('p', { class: 'explain' }, t(`level2.msgs.m${msg.id}.explain`)));
          }
        };
        review.addEventListener('click', () => {
          const ev = evaluate(msg, ms);
          if (!ms.verdict) { clear(fb).append(feedback(false, t('level2.fb.needVerdict'))); return; }
          if (!ms.reviewed) { ms.first = ev.correct; ms.reviewed = true; }
          save();
          showFeedback();
          updateTabs();
          announce(ev.complete ? t('level2.fb.msgDone', { n: msg.id }) : t('level2.fb.msgPending', { n: msg.id }));
        });
        if (ms.reviewed) showFeedback();

        const speakText = () => [senderName(msg), msg.contextKey ? t(msg.contextKey) : '', content.innerText].join('. ');
        card.append(...[
          h('header', { class: 'msg-head' },
            h('h3', { id: `msg-${msg.id}-h`, class: 'msg-title' }, h('span', { class: 'msg-num' }, t('level2.msgN', { n: msg.id }))),
            senderBtn, speakButton(speakText, t('level2.msgN', { n: msg.id }))),
          details,
          msg.contextKey ? h('p', { class: 'context' }, h('span', { 'aria-hidden': 'true' }, '📌 '), t('level2.context'), ': ', t(msg.contextKey)) : null,
          content, markCount, verdictRow, actionsBox,
          h('div', { class: 'btn-row' }, review), fb
        ].filter(Boolean));
        refresh();
        return card;
      };

      const renderPanel = () => {
        clear(panel);
        panel.setAttribute('aria-labelledby', `tab-${draft.tab}`);
        MESSAGES.filter((m) => m.channel === draft.tab).forEach((m) => panel.append(renderMessage(m)));
        updateTabs();
      };

      for (const ch of CHANNELS) {
        const tab = h('button', { type: 'button', role: 'tab', id: `tab-${ch}`, class: 'tab', 'aria-controls': 'l2-panel' },
          h('span', { 'aria-hidden': 'true', class: 'tab-icon' }, CHANNEL_ICON[ch]), h('span', { class: 'tab-name' }, t(`level2.channels.${ch}`)),
          h('span', { class: 'tab-count' }));
        tab.addEventListener('click', () => { draft.tab = ch; save(); renderPanel(); });
        tab.addEventListener('keydown', (e) => {
          const i = CHANNELS.indexOf(ch);
          let j = null;
          if (e.key === 'ArrowRight') j = (i + 1) % CHANNELS.length;
          if (e.key === 'ArrowLeft') j = (i + CHANNELS.length - 1) % CHANNELS.length;
          if (e.key === 'Home') j = 0;
          if (e.key === 'End') j = CHANNELS.length - 1;
          if (j !== null) { e.preventDefault(); draft.tab = CHANNELS[j]; save(); renderPanel(); tabs[CHANNELS[j]].focus(); }
        });
        tabs[ch] = tab;
        tabList.append(tab);
      }
      panel.id = 'l2-panel';
      renderPanel();

      return h('div', { class: 'phone-wrap' },
        h('div', { class: 'phone' },
          h('div', { class: 'phone-top', 'aria-hidden': 'true' }, h('span', {}, '09:41'), h('span', {}, t('level2.phone')), h('span', {}, '▮▮▮ 🔋')),
          tabList, panel, linkBar,
          h('p', { id: 'l2-linkbar-help', class: 'sr-only' }, t('level2.linkHelp'))
        ),
        h('div', { class: 'card legend' }, h('h3', {}, t('level2.howTitle')), h('ol', {}, [1, 2, 3, 4].map((n) => h('li', {}, t(`level2.how.${n - 1}`)))))
      );
    },
    check(draft) {
      const states = MESSAGES.map((m) => [m, msgState(draft, m.id)]);
      if (states.some(([, ms]) => !ms.reviewed)) return { ok: false, reason: t('level2.lock.notAll') };
      const evals = states.map(([m, ms]) => [m, ms, evaluate(m, ms)]);
      const correct = evals.filter(([, , e]) => e.correct).length;
      if (correct < PASS_CORRECT) return { ok: false, reason: t('level2.lock.notEnough', { n: correct, min: PASS_CORRECT }) };
      const incomplete = evals.filter(([m, ms, e]) => m.fraud && ms.verdict === 'fraud' && (e.cluesOk < MIN_CLUES || !e.actionsOk));
      if (incomplete.length) return { ok: false, reason: t('level2.lock.clues', { list: incomplete.map(([m]) => m.id).join(', '), min: MIN_CLUES }) };
      const byChannel = {};
      for (const ch of CHANNELS) byChannel[ch] = evals.filter(([m, , e]) => m.channel === ch && e.correct).length;
      const score = {
        correct,
        firstTry: states.filter(([, ms]) => ms.first).length,
        byChannel,
        cluesMarked: evals.reduce((a, [, , e]) => a + e.cluesOk, 0),
        linksClicked: draft.linksClicked.length,
        linksClickedIn: [...new Set(draft.linksClicked)],
        missed: evals.filter(([, , e]) => !e.correct).map(([m]) => m.id)
      };
      return { ok: true, score };
    }
  }, ctx);
}

export { markables };
