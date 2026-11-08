// Lectura en veu alta amb la Web Speech API (speechSynthesis).
// - Només es fan servir veus de l'idioma actiu (ca → ca-ES, es → es-ES...).
// - Es prefereixen les veus locals del dispositiu (localService): les veus «en línia»
//   envien el text a un servidor extern del fabricant del navegador.
// - L'usuari pot triar la veu (o cap) al menú d'accessibilitat; es desa a les preferències.
import { t, getLang, langInfo, onLangChange } from './i18n.js';
import { toast, getPrefs, setPrefs } from './ui.js';

const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
const buttons = new Set();
const voiceListeners = new Set();
let voices = [];
let speakingBtn = null;
export const NO_VOICE = 'none';

function refreshVoices() {
  if (!synth) return;
  voices = synth.getVoices();
  updateButtons();
  voiceListeners.forEach((fn) => fn());
}

if (synth) {
  refreshVoices();
  synth.addEventListener?.('voiceschanged', refreshVoices);
  onLangChange(() => { stop(); updateButtons(); });
}

export function onVoicesChanged(fn) {
  voiceListeners.add(fn);
  return () => voiceListeners.delete(fn);
}

function norm(l) {
  return String(l).toLowerCase().replace(/_/g, '-');
}

/** Veus del dispositiu per a un idioma, ordenades: locals primer, després la regió preferida. */
export function voicesFor(code = getLang()) {
  if (!synth) return [];
  const base = code.toLowerCase();
  const preferred = (langInfo(code)?.speech ?? [code]).map(norm);
  const list = voices.filter((v) => { const l = norm(v.lang); return l === base || l.startsWith(base + '-'); });
  const rank = (v) => (v.localService === false ? 10 : 0) + (preferred.includes(norm(v.lang)) ? 0 : 1);
  return list.sort((a, b) => rank(a) - rank(b));
}

export function voicePref(code = getLang()) {
  return (getPrefs().voices || {})[code] ?? null;
}

export function setVoicePref(code, uri) {
  const v = { ...(getPrefs().voices || {}) };
  if (uri) v[code] = uri; else delete v[code];
  setPrefs({ voices: v });
  stop();
  updateButtons();
}

export function voiceFor(code = getLang()) {
  const list = voicesFor(code);
  const pref = voicePref(code);
  if (pref === NO_VOICE) return null;
  return (pref && list.find((v) => v.voiceURI === pref)) || list[0] || null;
}

export function canSpeak(code = getLang()) {
  return Boolean(voiceFor(code));
}

export function stop() {
  if (synth) synth.cancel();
  if (speakingBtn) speakingBtn.setAttribute('aria-pressed', 'false');
  speakingBtn = null;
}

export function speak(text, btn) {
  const voice = voiceFor();
  if (!voice) {
    toast(t('a11y.noVoice', { lang: langInfo().label }));
    return;
  }
  if (speakingBtn === btn && synth.speaking) { stop(); return; }
  stop();
  const u = new SpeechSynthesisUtterance(text);
  // la llengua sempre és la de l'idioma actiu, encara que el navegador ignori la veu triada
  u.lang = norm(voice.lang).startsWith(getLang()) ? String(voice.lang).replace(/_/g, '-') : (langInfo().speech?.[0] ?? getLang());
  try { u.voice = voice; } catch { /* alguns navegadors només accepten la llengua */ }
  u.rate = 0.95;
  u.onend = u.onerror = () => { if (speakingBtn === btn) stop(); };
  speakingBtn = btn;
  btn?.setAttribute('aria-pressed', 'true');
  synth.speak(u);
}

function updateButton(btn) {
  const ok = canSpeak();
  btn.setAttribute('aria-disabled', ok ? 'false' : 'true');
  btn.title = ok ? t('a11y.listen') : t('a11y.noVoice', { lang: langInfo().label });
}

function updateButtons() {
  for (const b of [...buttons]) {
    if (!b.isConnected) { buttons.delete(b); continue; }
    updateButton(b);
  }
}

/**
 * Botó 🔊. getText pot ser una funció (que retorna el text) o un element
 * del qual es llegirà el textContent.
 */
export function speakButton(getText, labelText) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tts-btn';
  btn.setAttribute('aria-pressed', 'false');
  btn.innerHTML = '<span aria-hidden="true">🔊</span>';
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = labelText ? t('a11y.listenLabel', { what: labelText }) : t('a11y.listen');
  btn.append(sr);
  btn.addEventListener('click', () => {
    const text = typeof getText === 'function' ? getText() : (getText?.innerText ?? getText?.textContent ?? '');
    speak(String(text).replace(/\s+/g, ' ').trim(), btn);
  });
  buttons.add(btn);
  updateButton(btn);
  return btn;
}
