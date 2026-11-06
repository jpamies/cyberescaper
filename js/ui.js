// Utilitats d'interfície: constructor d'elements, avisos aria-live, diàlegs propis,
// missatges de Les Ombres (efecte màquina d'escriure) i preferències d'accessibilitat.
import { t } from './i18n.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

// --- regió aria-live -------------------------------------------------------
export function announce(msg, { assertive = false } = {}) {
  const region = document.getElementById(assertive ? 'live-assertive' : 'live-polite');
  if (!region) return;
  region.textContent = '';
  setTimeout(() => { region.textContent = msg; }, 30);
}

export function toast(msg) {
  let box = document.getElementById('toast');
  if (!box) {
    box = h('div', { id: 'toast', class: 'toast', role: 'status' });
    document.body.append(box);
  }
  box.textContent = msg;
  box.classList.add('show');
  clearTimeout(box._timer);
  box._timer = setTimeout(() => box.classList.remove('show'), 4500);
}

// --- diàlegs propis (sense confirm()) --------------------------------------
export function dialog({ title, body, confirmText, cancelText, danger = false, alertOnly = false }) {
  return new Promise((resolve) => {
    const titleId = 'dlg-' + Math.random().toString(36).slice(2);
    const dlg = h('dialog', { class: 'dialog' + (danger ? ' danger' : ''), 'aria-labelledby': titleId });
    const ok = h('button', { type: 'button', class: danger ? 'btn btn-danger' : 'btn btn-primary' }, confirmText ?? t('dialog.ok'));
    const cancel = alertOnly ? null : h('button', { type: 'button', class: 'btn' }, cancelText ?? t('dialog.cancel'));
    dlg.append(
      h('h2', { id: titleId }, title),
      typeof body === 'string' ? h('p', {}, body) : body,
      h('div', { class: 'dialog-actions' }, cancel, ok)
    );
    let result = false;
    ok.addEventListener('click', () => { result = true; dlg.close(); });
    cancel?.addEventListener('click', () => dlg.close());
    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
    document.body.append(dlg);
    dlg.showModal();
    (cancel ?? ok).focus();
  });
}

// --- preferències (localStorage, amb try/catch) ----------------------------
const PREFS_KEY = 'cyberescaper:v1:prefs';
const DEFAULT_PREFS = { lang: null, font: 0, contrast: false, typewriter: true };

export function getPrefs() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function setPrefs(patch) {
  const p = { ...getPrefs(), ...patch };
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* sense emmagatzematge */ }
  applyPrefs(p);
  return p;
}

export function applyPrefs(p = getPrefs()) {
  const root = document.documentElement;
  root.dataset.font = String(p.font);
  root.dataset.theme = p.contrast ? 'contrast' : 'dark';
  root.dataset.typewriter = p.typewriter ? 'on' : 'off';
}

export function reducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// --- missatges de Les Ombres -----------------------------------------------
/** Missatge amb estil propi. El text complet és sempre accessible per al lector de pantalla. */
export function shadowMessage(text, { signature = true } = {}) {
  const typed = h('span', { class: 'typed', 'aria-hidden': 'true' });
  const full = h('span', { class: 'sr-only' }, text);
  const box = h('div', { class: 'shadow-msg' },
    h('div', { class: 'shadow-head', 'aria-hidden': 'true' }, '☠ ', t('shadows.name')),
    h('p', {}, full, typed),
    signature ? h('p', { class: 'shadow-sign' }, '— ', t('shadows.signature')) : null
  );
  const animate = getPrefs().typewriter && !reducedMotion();
  if (!animate) {
    typed.textContent = text;
  } else {
    let i = 0;
    const chars = [...text];
    const step = () => {
      if (!typed.isConnected && i > 0) return;
      typed.textContent = chars.slice(0, i).join('');
      if (i++ < chars.length) setTimeout(step, 22);
      else typed.classList.add('done');
    };
    requestAnimationFrame(step);
    box.addEventListener('click', () => { i = chars.length; typed.textContent = text; });
  }
  return box;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename, style: { display: 'none' } });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
}

export function loadScript(src) {
  loadScript.cache ??= new Map();
  if (!loadScript.cache.has(src)) {
    loadScript.cache.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = new URL(src, document.baseURI).href;
      s.onload = resolve;
      s.onerror = () => reject(new Error('load ' + src));
      document.head.append(s);
    }));
  }
  return loadScript.cache.get(src);
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
