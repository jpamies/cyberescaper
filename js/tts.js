// Lectura en veu alta amb la Web Speech API (speechSynthesis), sense xarxa.
import { t, getLang, langInfo, onLangChange } from './i18n.js';
import { toast } from './ui.js';

const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
const buttons = new Set();
let voices = [];
let speakingBtn = null;

function refreshVoices() {
  if (!synth) return;
  voices = synth.getVoices();
  updateButtons();
}

if (synth) {
  refreshVoices();
  synth.addEventListener?.('voiceschanged', refreshVoices);
  onLangChange(() => { stop(); updateButtons(); });
}

function norm(l) {
  return String(l).toLowerCase().replace('_', '-');
}

export function voiceFor(code = getLang()) {
  if (!synth) return null;
  const prefs = (langInfo(code)?.speech ?? [code]).map(norm);
  for (const p of prefs) {
    const v = voices.find((x) => norm(x.lang) === p) || voices.find((x) => norm(x.lang).startsWith(p.split('-')[0] + '-') || norm(x.lang) === p.split('-')[0]);
    if (v) return v;
  }
  return null;
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
  try { u.voice = voice; } catch { /* alguns navegadors només accepten la llengua */ }
  u.lang = voice.lang;
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
