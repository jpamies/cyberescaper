// Estat de la partida: la font de veritat és la cadena; localStorage només n'és la memòria cau.
import { createGenesis, appendBlock, verifyChain, validateChainData } from './chain.js';
import { deriveState } from './derive.js';
import { buildExport, parseAny, parseExport, APP_VERSION } from './codec.js';

export const NS = 'cyberescaper:v1:';
const CHAIN_KEY = NS + 'chain';
const DRAFT_KEY = (l) => `${NS}draft:${l}`;
export const LASTTICK_KEY = NS + 'lastTick';

let chain = [];
let derivedCache = null;
let queue = Promise.resolve();
const listeners = new Set();

function store(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function read(key) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? null : JSON.parse(v);
  } catch {
    return null;
  }
}

function emit() {
  derivedCache = null;
  listeners.forEach((fn) => fn());
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Carrega la partida de localStorage. Si la memòria cau està malmesa, no la fa servir. */
export async function load() {
  const saved = read(CHAIN_KEY);
  if (Array.isArray(saved) && saved.length) {
    const broken = await verifyChain(saved);
    if (broken === -1 && validateChainData(saved) === -1) {
      chain = saved;
    } else {
      chain = [];
      return { corrupted: broken === -1 ? 0 : broken };
    }
  }
  emit();
  return {};
}

export function hasTeam() {
  return chain.length > 0;
}

export function getChain() {
  return chain;
}

export function derived() {
  if (!derivedCache) derivedCache = deriveState(chain);
  return derivedCache;
}

/** Derivat amb el temps actual (per al temporitzador). */
export function derivedNow() {
  return deriveState(chain, Date.now());
}

function persist() {
  store(CHAIN_KEY, chain);
}

export function createTeam({ alias, members, lang }) {
  queue = queue.then(async () => {
    const data = { appVersion: APP_VERSION, alias, members, lang, date: new Date().toISOString().slice(0, 10) };
    chain = await createGenesis(data);
    clearDrafts();
    persist();
    emit();
  });
  return queue;
}

/** Afegeix un esdeveniment. Les crides es fan en cua perquè cada bloc enllaci amb l'anterior. */
export function append(type, data) {
  const p = queue.then(async () => {
    chain = await appendBlock(chain, type, data);
    persist();
    emit();
    return chain[chain.length - 1];
  });
  queue = p.catch(() => {});
  return p;
}

export function exportObject() {
  return buildExport(chain);
}

/**
 * Importa una partida (objecte JSON o text: JSON / codi de verificació).
 * Retorna { ok, broken, reason }.
 */
export async function importGame(input) {
  let parsed;
  try {
    parsed = typeof input === 'string' ? await parseAny(input) : { ...parseExport(input), source: 'json' };
  } catch (e) {
    return { ok: false, reason: e.code === 'code' ? 'code' : 'format' };
  }
  const broken = await verifyChain(parsed.chain);
  if (broken !== -1) return { ok: false, broken, reason: 'tampered' };
  const badData = validateChainData(parsed.chain);
  if (badData !== -1) return { ok: false, broken: badData, reason: 'privacy' };

  await queue;
  chain = parsed.chain;
  clearDrafts();
  // si hi havia una sessió en marxa, el rellotge es va aturar en exportar
  store(LASTTICK_KEY, Date.parse(parsed.header.generatedAt) || Date.now());
  persist();
  emit();
  await append('import', { source: parsed.source, blocks: parsed.chain.length });
  return { ok: true, alias: chain[0].data.alias };
}

// --- esborranys dels nivells (només dades no sensibles; MAI la contrasenya del nivell 1) ---
export function getDraft(level) {
  return read(DRAFT_KEY(level)) || {};
}

export function setDraft(level, draft) {
  store(DRAFT_KEY(level), draft);
}

function clearDrafts() {
  for (let l = 0; l < 5; l++) store(DRAFT_KEY(l), null);
}

/** Esborra totes les dades de l'app d'aquest ordinador. */
export function wipe() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(NS)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch { /* res */ }
  chain = [];
  emit();
}
