// Format d'exportació i codi de verificació (JSON comprimit amb deflate-raw + base64url).
// Mòdul pur (funciona al navegador i a Node 18+).

export const APP_ID = 'cyberescaper';
export const APP_VERSION = '1.0.0';

export function buildExport(chain, { now = new Date() } = {}) {
  const genesis = chain[0] ?? { data: {} };
  return {
    header: {
      app: APP_ID,
      version: APP_VERSION,
      alias: genesis.data.alias ?? '',
      generatedAt: now.toISOString()
    },
    chain
  };
}

/** Accepta un objecte exportat i en retorna { header, chain } o llança un error amb codi. */
export function parseExport(obj) {
  if (!obj || typeof obj !== 'object') throw codedError('format');
  const header = obj.header;
  const chain = obj.chain;
  if (!header || header.app !== APP_ID || !Array.isArray(chain)) throw codedError('format');
  return { header, chain };
}

function codedError(code) {
  const e = new Error(code);
  e.code = code;
  return e;
}

function toBase64Url(bytes) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const clean = text.replace(/[\s]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = clean.length % 4 === 0 ? '' : '='.repeat(4 - (clean.length % 4));
  const bin = atob(clean + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

export async function encodeCode(obj) {
  const json = new TextEncoder().encode(JSON.stringify(obj));
  const packed = await pipe(json, new CompressionStream('deflate-raw'));
  return toBase64Url(packed);
}

export async function decodeCode(code) {
  let bytes;
  try {
    bytes = fromBase64Url(code);
  } catch {
    throw codedError('code');
  }
  try {
    const raw = await pipe(bytes, new DecompressionStream('deflate-raw'));
    return JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw codedError('code');
  }
}

/** Llegeix un text que pot ser JSON o un codi de verificació. */
export async function parseAny(text) {
  const trimmed = String(text).trim();
  if (trimmed.startsWith('{')) {
    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      throw codedError('format');
    }
    return { ...parseExport(obj), source: 'json' };
  }
  return { ...parseExport(await decodeCode(trimmed)), source: 'code' };
}

export function splitLines(text, width = 80) {
  const lines = [];
  for (let i = 0; i < text.length; i += width) lines.push(text.slice(i, i + width));
  return lines;
}

export function exportFileName(alias, ext, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  const safe = String(alias).normalize('NFD').replace(/[^\w]/g, '') || 'equip';
  return `cyberescaper_${safe}_${date}.${ext}`;
}
