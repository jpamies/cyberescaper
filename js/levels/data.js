// Dades (respostes i estructura) dels nivells 0, 1, 3 i 4. Els textos són a i18n.

// Nivell 0 · 10 zones de l'escena: 8 errors reals i 2 distractors.
export const LEVEL0_ZONES = [
  { id: 'postit', risk: true },
  { id: 'session', risk: true },
  { id: 'usb', risk: true },
  { id: 'email', risk: true },
  { id: 'wifi', risk: true },
  { id: 'antivirus', risk: true },
  { id: 'update', risk: true },
  { id: 'file', risk: true },
  { id: 'plant', risk: false },
  { id: 'calendar', risk: false }
];
export const LEVEL0_ANSWER = 8;

// Nivell 1 · Part A
export const LEVEL1_SAMPLES = [
  { id: 'p1', password: '123456', answer: 'weak' },
  { id: 'p2', password: 'Barcelona2010', answer: 'medium' },
  { id: 'p3', password: 'maria2009', answer: 'weak' },
  { id: 'p4', password: 'T3cn0logia!', answer: 'medium' },
  { id: 'p5', password: 'gat-taronja-pluja-47!', answer: 'strong' }
];
export const LEVEL1_MIN_OK = 4;
export const STRENGTH_LEVELS = ['weak', 'medium', 'strong'];

// Nivell 3 · Part A: dades del perfil de la Laia
export const MEASURES = ['private', 'delete', 'location', 'dontPost'];
export const LEVEL3_ITEMS = [
  { id: 'birth', risk: true, ok: ['dontPost'] },
  { id: 'school', risk: true, ok: ['delete', 'private'] },
  { id: 'location', risk: true, ok: ['location', 'delete'] },
  { id: 'pet', risk: true, ok: ['dontPost', 'delete'] },
  { id: 'phone', risk: true, ok: ['dontPost'] },
  { id: 'street', risk: true, ok: ['delete'] },
  { id: 'schedule', risk: true, ok: ['delete', 'dontPost', 'private'] },
  { id: 'ticket', risk: true, ok: ['delete'] },
  { id: 'hobby', risk: false },
  { id: 'firstday', risk: false }
];
export const LEVEL3_MIN = 6;
// Part B: ordre correcte dels passos i ordre inicial (barrejat, sempre igual)
export const LEVEL3_STEPS = ['s1', 's2', 's3', 's4', 's5'];
export const LEVEL3_SHUFFLED = ['s3', 's5', 's1', 's4', 's2'];
export const RECOVERY_CODES = ['4F7K-2M9Q', 'X8PL-61ZD', 'R3TW-9KQ2', 'M5VN-07HC'];

// Nivell 4
export const LEVEL4_QUIZ = ['a', 'b', 'c', 'd'];
export const LEVEL4_QUIZ_OK = 'a';
