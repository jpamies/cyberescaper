// Cadena de hashes de CyberEscaper.
// Mòdul pur: sense accés al DOM, es pot provar amb Node (node --test).
//
// hash = SHA-256(prevHash + JSON canònic del bloc sense el camp "hash")

export const ZERO_HASH = '0'.repeat(64);
export const REPORT_MAX = 500;
const STRING_MAX = 64;

export class PrivacyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PrivacyError';
  }
}

/** JSON canònic: claus ordenades alfabèticament de forma recursiva, sense espais. */
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new TypeError('Non-finite number');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((v) => (v === undefined ? 'null' : canonicalize(v))).join(',') + ']';
  }
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
}

export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function computeHash(block) {
  const { hash, ...rest } = block;
  return sha256Hex(String(block.prevHash) + canonicalize(rest));
}

// ---------------------------------------------------------------------------
// Llista de camps permesos (límit de privadesa).
// Qualsevol camp que no surti aquí es rebutja. Tipus: 'number', 'string',
// 'boolean', [esquema] (llista) o { ... } (objecte). Tots els camps són opcionals.
// ---------------------------------------------------------------------------
const SCORE = {
  // nivell 0
  found: 'number', distractors: 'number',
  // nivell 1
  classification: 'number', passphraseOk: 'boolean', passphraseLength: 'number',
  // nivell 2
  correct: 'number', firstTry: 'number', cluesMarked: 'number', linksClicked: 'number',
  byChannel: { email: 'number', sms: 'number', whatsapp: 'number', instagram: 'number' },
  missed: ['number'], linksClickedIn: ['number'],
  // nivell 3
  dataFound: 'number', measuresOk: 'number', stepsOk: 'boolean', stepsAttempts: 'number', totpOk: 'boolean',
  // nivell 4
  decryptOk: 'boolean', encryptOk: 'boolean', tamperDetected: 'boolean', quizOk: 'boolean'
};

export const SCHEMAS = {
  genesis: {
    appVersion: 'string', alias: 'string', lang: 'string', date: 'string',
    members: [{ role: 'string', specialty: 'string', avatar: 'string', initial: 'string' }]
  },
  session_start: { session: 'number' },
  session_pause: { session: 'number', elapsedSec: 'number', auto: 'boolean' },
  hint_used: { level: 'number', hint: 'number' },
  level_completed: {
    level: 'number', points: 'number', hintsUsed: 'number', attempts: 'number',
    score: SCORE, report: 'string'
  },
  overtime: { session: 'number', penalty: 'number' },
  import: { source: 'string', blocks: 'number' },
  final: { totalPoints: 'number', badges: ['string'], noHintLevels: ['number'] }
};

export const EVENT_TYPES = Object.keys(SCHEMAS);
export const ALIAS_RE = /^[\p{L}\p{N}]{3,20}$/u;

function check(schema, value, path) {
  if (typeof schema === 'string') {
    if (typeof value !== schema) throw new PrivacyError(`${path}: expected ${schema}`);
    if (schema === 'number' && !Number.isFinite(value)) throw new PrivacyError(`${path}: invalid number`);
    if (schema === 'string') {
      const max = path.endsWith('.report') ? REPORT_MAX : STRING_MAX;
      return [...value].slice(0, max).join('');
    }
    return value;
  }
  if (Array.isArray(schema)) {
    if (!Array.isArray(value)) throw new PrivacyError(`${path}: expected list`);
    if (value.length > 20) throw new PrivacyError(`${path}: list too long`);
    return value.map((v, i) => check(schema[0], v, `${path}[${i}]`));
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new PrivacyError(`${path}: expected object`);
  }
  const out = {};
  for (const key of Object.keys(value)) {
    if (!(key in schema)) throw new PrivacyError(`${path}.${key}: field not allowed`);
    if (value[key] === undefined) continue;
    out[key] = check(schema[key], value[key], `${path}.${key}`);
  }
  return out;
}

/**
 * Valida i neteja les dades d'un esdeveniment: rebutja camps no permesos,
 * retalla l'informe a 500 caràcters i la resta de textos a 64.
 */
export function sanitizeData(type, data) {
  const schema = SCHEMAS[type];
  if (!schema) throw new PrivacyError(`unknown event type: ${type}`);
  const clean = check(schema, data ?? {}, type);
  if (type === 'genesis' && !ALIAS_RE.test(clean.alias ?? '')) {
    throw new PrivacyError('genesis.alias: invalid alias');
  }
  if (type === 'level_completed' && typeof clean.report === 'string') {
    clean.report = clean.report.trim();
  }
  return clean;
}

function nowIso() {
  return new Date().toISOString();
}

async function makeBlock(index, type, data, prevHash, timestamp) {
  const block = { index, timestamp: timestamp ?? nowIso(), type, data: sanitizeData(type, data), prevHash };
  block.hash = await computeHash(block);
  return block;
}

/** Crea el bloc gènesi. Retorna una cadena nova (array) amb un sol bloc. */
export async function createGenesis(data, { timestamp } = {}) {
  return [await makeBlock(0, 'genesis', data, ZERO_HASH, timestamp)];
}

/** Afegeix un bloc. No modifica la cadena rebuda: en retorna una de nova. */
export async function appendBlock(chain, type, data, { timestamp } = {}) {
  if (!Array.isArray(chain) || chain.length === 0) throw new Error('Empty chain: create genesis first');
  if (type === 'genesis') throw new Error('Only one genesis block');
  const last = chain[chain.length - 1];
  const block = await makeBlock(chain.length, type, data, last.hash, timestamp);
  return [...chain, block];
}

/** Retorna l'índex del primer bloc trencat o -1 si la cadena és íntegra. */
export async function verifyChain(chain) {
  if (!Array.isArray(chain) || chain.length === 0) return 0;
  for (let i = 0; i < chain.length; i++) {
    const b = chain[i];
    if (!b || typeof b !== 'object') return i;
    const expectedPrev = i === 0 ? ZERO_HASH : chain[i - 1].hash;
    if (b.index !== i || b.prevHash !== expectedPrev) return i;
    if (i === 0 && b.type !== 'genesis') return i;
    if (i > 0 && b.type === 'genesis') return i;
    let h;
    try {
      h = await computeHash(b);
    } catch {
      return i;
    }
    if (h !== b.hash) return i;
  }
  return -1;
}

/** Retorna l'índex del primer bloc amb camps no permesos, o -1. */
export function validateChainData(chain) {
  for (let i = 0; i < chain.length; i++) {
    const b = chain[i];
    const allowed = ['index', 'timestamp', 'type', 'data', 'prevHash', 'hash'];
    if (Object.keys(b).some((k) => !allowed.includes(k))) return i;
    try {
      const clean = sanitizeData(b.type, b.data);
      if (canonicalize(clean) !== canonicalize(b.data)) return i;
    } catch {
      return i;
    }
  }
  return -1;
}

export function shortHash(h, n = 10) {
  return typeof h === 'string' ? h.slice(0, n) : '';
}
