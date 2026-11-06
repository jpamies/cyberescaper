// Internacionalització. La llista d'idiomes surt NOMÉS d'aquest array:
// per afegir-ne un, creeu i18n/<codi>.json amb les mateixes claus i afegiu-lo aquí.
export const LANGS = [
  { code: 'ca', label: 'Català', dir: 'ltr', speech: ['ca-ES', 'ca'] },
  { code: 'es', label: 'Castellano', dir: 'ltr', speech: ['es-ES', 'es'] }
  // { code: 'en', label: 'English', dir: 'ltr', speech: ['en-GB', 'en'] },
  // { code: 'ar', label: 'العربية', dir: 'rtl', speech: ['ar'] },
];
export const DEFAULT_LANG = 'ca';

const cache = new Map();
let current = DEFAULT_LANG;
let dict = {};
const listeners = new Set();

export async function loadDict(code) {
  if (!cache.has(code)) {
    const url = new URL(`../i18n/${code}.json`, import.meta.url);
    cache.set(code, fetch(url).then((r) => {
      if (!r.ok) throw new Error(`i18n ${code}: ${r.status}`);
      return r.json();
    }));
  }
  return cache.get(code);
}

export async function setLang(code) {
  const lang = LANGS.find((l) => l.code === code) ?? LANGS.find((l) => l.code === DEFAULT_LANG);
  dict = await loadDict(lang.code);
  current = lang.code;
  document.documentElement.lang = lang.code;
  document.documentElement.dir = lang.dir;
  listeners.forEach((fn) => fn(current));
  return current;
}

export function getLang() {
  return current;
}

export function langInfo(code = current) {
  return LANGS.find((l) => l.code === code);
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function lookup(d, key) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), d);
}

/** Tradueix una clau ("level0.title") i substitueix {paràmetres}. */
export function t(key, params) {
  let v = lookup(dict, key);
  if (v === undefined) return key;
  if (typeof v !== 'string') return v;
  if (params) v = v.replace(/\{(\w+)\}/g, (m, p) => (p in params ? String(params[p]) : m));
  return v;
}

/** Tradueix en un idioma concret (cal haver-lo carregat amb loadDict). */
export async function tIn(code, key) {
  const d = await loadDict(code);
  return lookup(d, key) ?? key;
}
