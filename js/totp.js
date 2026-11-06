// TOTP (RFC 6238) calculat al navegador amb Web Crypto. Secret FICTICI, només per a la simulació.

export const DEMO_SECRET = 'JBSWY3DPEHPK3PXPCYBERESC';
export const PERIOD = 30;

export function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input.replace(/=+$/, '').toUpperCase();
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return new Uint8Array(out);
}

export async function hotp(secretBytes, counter, digits = 6) {
  const key = await globalThis.crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const msg = new ArrayBuffer(8);
  const view = new DataView(msg);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const mac = new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', key, msg));
  const off = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export async function totp(secret = DEMO_SECRET, now = Date.now()) {
  return hotp(base32Decode(secret), Math.floor(now / 1000 / PERIOD));
}

/** Accepta el codi actual o l'anterior (marge de 30 s). */
export async function verifyTotp(code, secret = DEMO_SECRET, now = Date.now()) {
  const c = String(code).replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return false;
  for (const delta of [0, -1]) {
    if ((await totp(secret, now + delta * PERIOD * 1000)) === c) return true;
  }
  return false;
}

export function secondsLeft(now = Date.now()) {
  return PERIOD - (Math.floor(now / 1000) % PERIOD);
}

export function otpauthUri(secret = DEMO_SECRET) {
  return `otpauth://totp/CyberEscaper:laia.ex?secret=${secret}&issuer=CyberEscaper&period=${PERIOD}`;
}
