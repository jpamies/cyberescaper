// Comprovador de robustesa de contrasenyes, 100 % local i sense llibreries.
// Estima l'entropia i detecta patrons comuns: seqüències, paraules d'un
// diccionari petit, anys, repeticions i substitucions l33t.
// Mòdul pur (es prova amb Node). No guarda res.

const COMMON = new Set([
  '123456', '123456789', '12345678', '12345', '1234567', '1234', '111111', '000000', '123123',
  'password', 'password1', 'qwerty', 'qwerty123', 'abc123', 'iloveyou', 'admin', 'letmein',
  'contrasenya', 'contraseña', 'contrasena', 'hola123', 'barcelona', 'futbol', 'teamo', 'tequiero'
]);

// Diccionari petit (català, castellà, anglès, noms i llocs freqüents).
export const DICTIONARY = [
  // català
  'casa', 'gat', 'gos', 'sol', 'mar', 'cel', 'pluja', 'taronja', 'blau', 'blava', 'vermell', 'verd', 'groc',
  'negre', 'blanc', 'amor', 'hola', 'adeu', 'escola', 'institut', 'classe', 'basquet', 'musica', 'tecnologia',
  'informatica', 'ordinador', 'mobil', 'joc', 'amic', 'amiga', 'familia', 'mare', 'pare', 'avia', 'nit',
  'lluna', 'estrella', 'foc', 'aigua', 'terra', 'vent', 'neu', 'flor', 'arbre', 'poma', 'platja', 'muntanya',
  'ciutat', 'contrasenya', 'seguretat', 'secret', 'clau', 'drac', 'princesa',
  // castellà
  'perro', 'gato', 'cielo', 'luna', 'madre', 'padre', 'amigo', 'escuela', 'contrasena', 'clave', 'secreto',
  'tesoro', 'dragon', 'naranja', 'lluvia', 'azul', 'rojo', 'verde', 'tecnologia', 'futbol', 'teamo', 'tequiero',
  // anglès
  'password', 'love', 'monkey', 'football', 'princess', 'sunshine', 'shadow', 'master', 'welcome', 'admin',
  'letmein', 'superman', 'batman', 'pokemon', 'minecraft', 'fortnite', 'roblox', 'hello', 'dragon',
  // llocs
  'barcelona', 'girona', 'lleida', 'tarragona', 'catalunya', 'madrid', 'espanya', 'espana', 'sevilla',
  'valencia', 'barca', 'messi',
  // noms freqüents
  'maria', 'marc', 'laia', 'jordi', 'anna', 'laura', 'marta', 'david', 'joan', 'martina', 'julia', 'lucia',
  'sofia', 'alex', 'daniel', 'pablo', 'carlos', 'paula', 'sara', 'hugo', 'mohamed', 'fatima', 'yasmin',
  'omar', 'adam', 'nora', 'aina', 'arnau', 'pol', 'nil'
];
const DICT = [...new Set(DICTIONARY)].filter((w) => w.length >= 3).sort((a, b) => b.length - a.length);

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };
const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890'];

function stripAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function charClasses(pw) {
  let lower = false, upper = false, digit = false, symbol = false;
  for (const ch of pw) {
    if (/\d/.test(ch)) digit = true;
    else if (ch.toLowerCase() !== ch.toUpperCase()) {
      if (ch === ch.toLowerCase()) lower = true; else upper = true;
    } else symbol = true;
  }
  return { lower, upper, digit, symbol, count: [lower, upper, digit, symbol].filter(Boolean).length };
}

function poolSize(c) {
  return (c.lower ? 26 : 0) + (c.upper ? 26 : 0) + (c.digit ? 10 : 0) + (c.symbol ? 33 : 0) || 1;
}

/** Troba seqüències de 3 o més caràcters (abc, 321, qwe...). Retorna llista de [inici, fi). */
function findSequences(s) {
  const out = [];
  let i = 0;
  while (i < s.length - 2) {
    let j = i + 1;
    const step = s.charCodeAt(i + 1) - s.charCodeAt(i);
    if (Math.abs(step) === 1) {
      while (j < s.length && s.charCodeAt(j) - s.charCodeAt(j - 1) === step) j++;
      if (j - i >= 3) { out.push([i, j]); i = j; continue; }
    }
    // files del teclat
    let found = false;
    for (const row of KEYBOARD_ROWS) {
      let k = 0;
      while (i + k < s.length && row.includes(s.slice(i, i + k + 1))) k++;
      if (k >= 4 && !/^\d+$/.test(s.slice(i, i + k))) { out.push([i, i + k]); i += k; found = true; break; }
    }
    if (!found) i++;
  }
  return out;
}

function findRepeats(s) {
  if (/(.)\1\1/.test(s)) return true;
  const m = s.match(/^(.{2,})\1+$/);
  return Boolean(m);
}

function findWords(norm) {
  const words = [];
  let i = 0;
  while (i < norm.length) {
    const w = DICT.find((d) => norm.startsWith(d, i));
    if (w) { words.push({ word: w, start: i, end: i + w.length }); i += w.length; } else i++;
  }
  return words;
}

/** Paraules de la frase: grups de 2 o més lletres separats per altres caràcters. */
export function countWords(pw) {
  return (pw.match(/\p{L}{2,}/gu) || []).length;
}

export function analyze(pw) {
  const password = String(pw ?? '');
  const chars = [...password];
  const len = chars.length;
  const classes = charClasses(password);
  const lower = stripAccents(password.toLowerCase());
  const leetNorm = [...lower].map((c) => LEET[c] ?? c).join('');
  const patterns = [];

  if (len === 0) return { level: 'weak', score: 0, bits: 0, patterns, length: 0, classes, words: 0 };

  const isCommon = COMMON.has(lower) || COMMON.has(leetNorm);
  if (isCommon) patterns.push({ id: 'common' });

  const seqs = findSequences(lower);
  const seqLen = seqs.reduce((a, [s, e]) => a + (e - s), 0);
  if (seqs.length) patterns.push({ id: 'seq', value: seqs.map(([s, e]) => lower.slice(s, e)).join(', ') });

  const repeats = findRepeats(lower);
  if (repeats) patterns.push({ id: 'repeat' });

  const plainWords = findWords(lower);
  const leetWords = findWords(leetNorm);
  const usedLeet = leetNorm !== lower && leetWords.some((w) => !plainWords.some((p) => p.word === w.word));
  const words = usedLeet ? leetWords : plainWords;
  if (usedLeet) patterns.push({ id: 'leet' });
  for (const w of words) patterns.push({ id: 'dict', value: w.word });

  const years = lower.match(/(19[5-9]\d|20[0-3]\d)/g) || [];
  for (const y of years) patterns.push({ id: 'year', value: y });

  const wordCount = countWords(password);
  const isPhrase = wordCount >= 3 && len >= 12;
  if (isPhrase) patterns.push({ id: 'phrase' });
  if (len < 12) patterns.push({ id: 'short' });

  // --- puntuació (explicable a l'alumnat) ---
  let score = Math.min(len, 20) * 4 + (classes.count - 1) * 8;
  if (isCommon) score -= 40;
  if (seqLen >= len / 2) score -= 30; else if (seqs.some(([s, e]) => e - s >= 4)) score -= 10;
  if (repeats) score -= 15;
  const dominant = words.some((w) => (w.end - w.start) / len >= 0.5);
  if (dominant) score -= 20;
  if (years.length) score -= 10;
  if (isPhrase) score += 10;
  score = Math.max(0, Math.min(100, score));
  const level = score < 30 ? 'weak' : score < 70 ? 'medium' : 'strong';

  // --- entropia estimada: les parts previsibles valen pocs bits ---
  const pool = poolSize(classes);
  const covered = new Array(len).fill(false);
  let bits = 0;
  for (const w of words) { bits += 11 + (classes.upper ? 1 : 0); for (let i = w.start; i < w.end; i++) covered[i] = true; }
  for (const [s, e] of seqs) { if (!covered[s]) bits += 4; for (let i = s; i < e; i++) covered[i] = true; }
  for (const y of years) {
    const at = lower.indexOf(y);
    if (at >= 0 && !covered[at]) { bits += 6.5; for (let i = at; i < at + y.length; i++) covered[i] = true; }
  }
  for (let i = 0; i < len; i++) if (!covered[i]) bits += Math.log2(pool);
  if (isCommon) bits = Math.min(bits, 5);

  return { level, score, bits: Math.round(bits), patterns, length: len, classes, words: wordCount };
}

/** Criteris del mètode de la frase (nivell 1, part B). */
export function passphraseCriteria(pw) {
  const s = String(pw ?? '');
  const length = [...s].length >= 12;
  const words = countWords(s) >= 3;
  const numberOrSymbol = /[^\p{L}\s]/u.test(s);
  return { length, words, numberOrSymbol, ok: length && words && numberOrSymbol };
}
