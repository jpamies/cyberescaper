// Xifratge de Cèsar sobre l'alfabet A–Z (mòdul pur).

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function normalize(text) {
  return String(text)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function shiftLetter(ch, shift) {
  const i = ALPHABET.indexOf(ch);
  if (i < 0) return ch;
  return ALPHABET[(((i + shift) % 26) + 26) % 26];
}

export function encrypt(text, shift) {
  return [...normalize(text)].map((c) => shiftLetter(c, shift)).join('');
}

export function decrypt(text, shift) {
  return encrypt(text, -shift);
}

export function sameText(a, b) {
  return normalize(a) === normalize(b);
}
