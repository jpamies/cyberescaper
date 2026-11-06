// Nivell 2 · Bústia multicanal. Dades FICTÍCIES.
// Els textos són a i18n (level2.msgs.*). Aquí només hi ha l'estructura, les
// respostes i els valors que no es tradueixen (adreces, números, enllaços).
// Els enllaços fan servir dominis reservats (.example / .invalid) i MAI no naveguen.
// Els números de telèfon són del rang reservat per a ficció (+44 7700 900xxx).
//
// Parts d'un missatge:
//   { t: clau }                 text normal
//   { m: clau | lit, clue }     fragment que es pot marcar com a indici (clue = categoria o null)
//   { link: url, label, clue }  enllaç (mostra l'URL real a la barra; si es prem, «T'hem enxampat!»)

export const CHANNELS = ['email', 'sms', 'whatsapp', 'instagram'];

export const CLUE_TYPES = [
  'sender', 'link', 'urgency', 'money', 'code', 'attachment', 'typos', 'prize', 'newAccount', 'unexpected', 'excuse'
];

export const ACTIONS = ['noClick', 'verify', 'block', 'adult', 'call017', 'badClick', 'badReply'];
export const BAD_ACTIONS = ['badClick', 'badReply'];

const K = (id, k) => `level2.msgs.m${id}.${k}`;

export const MESSAGES = [
  {
    id: 1, channel: 'email', fraud: true,
    sender: { nameKey: K(1, 'from'), address: 'classroom-avisos@g00gle-edu.com', clue: 'sender', infoKeys: [K(1, 'info')] },
    subject: { m: K(1, 'subject'), clue: 'urgency' },
    body: [
      [{ t: K(1, 'p1') }],
      [{ t: K(1, 'p2a') }, { m: K(1, 'p2b'), clue: 'urgency' }, { t: K(1, 'p2c') }],
      [{ link: 'https://classroom.g00gle-edu.example/recuperar-tasca', labelKey: K(1, 'button'), button: true, clue: 'link' }]
    ]
  },
  {
    id: 2, channel: 'email', fraud: false,
    sender: { nameKey: K(2, 'from'), address: 'tutoria@institut-exemple.cat', clue: null, infoKeys: [K(2, 'info')] },
    subject: { m: K(2, 'subject'), clue: null },
    body: [
      [{ t: K(2, 'p1') }],
      [{ t: K(2, 'p2a') }, { m: K(2, 'p2b'), clue: null }, { t: K(2, 'p2c') }],
      [{ t: K(2, 'p3') }],
      [{ t: K(2, 'sign') }]
    ]
  },
  {
    id: 3, channel: 'sms', fraud: true, contextKey: K(3, 'context'),
    sender: { number: '+44 7700 900461', clue: 'sender', infoKeys: ['level2.sender.notSaved', 'level2.sender.foreign'] },
    body: [
      [{ m: K(3, 'a'), clue: 'unexpected' }, { t: 'level2.space' }, { m: K(3, 'b'), clue: 'money' }, { t: 'level2.space' },
        { link: 'https://bit.ly.example/3xKq9P', label: 'bit.ly.example/3xKq9P', clue: 'link' }]
    ]
  },
  {
    id: 4, channel: 'sms', fraud: false, contextKey: K(4, 'context'),
    sender: { name: 'CompteEDU', clue: null, infoKeys: [K(4, 'info')] },
    body: [
      [{ t: K(4, 'a') }, { m: null, lit: '482913', clue: null }, { t: K(4, 'b') }]
    ]
  },
  {
    id: 5, channel: 'whatsapp', fraud: true, contextKey: K(5, 'context'),
    sender: { number: '+44 7700 900872', clue: 'sender', infoKeys: ['level2.sender.notSaved', K(5, 'info')] },
    body: [
      [{ t: K(5, 'a') }],
      [{ m: K(5, 'b'), clue: 'money' }, { t: 'level2.space' }, { m: K(5, 'c'), clue: 'urgency' }],
      [{ m: K(5, 'd'), clue: 'excuse' }]
    ]
  },
  {
    id: 6, channel: 'whatsapp', fraud: true, contextKey: K(6, 'context'),
    sender: { nameKey: K(6, 'from'), number: '+44 7700 900518', clue: 'sender', infoKeys: ['level2.sender.saved', K(6, 'info')] },
    body: [
      [{ t: K(6, 'a') }],
      [{ m: K(6, 'b'), clue: 'code' }],
      [{ m: K(6, 'c'), clue: 'urgency' }]
    ]
  },
  {
    id: 7, channel: 'instagram', fraud: true,
    sender: { handle: '@premis.fortnite_oficial', clue: 'newAccount', infoKeys: [K(7, 'info1'), K(7, 'info2')] },
    body: [
      [{ m: K(7, 'a'), clue: 'prize' }],
      [{ t: K(7, 'b') }, { link: 'https://fortnite-premis.example/login', label: 'fortnite-premis.example', clue: 'link' }],
      [{ m: K(7, 'c'), clue: 'code' }]
    ]
  },
  {
    id: 8, channel: 'instagram', fraud: false,
    sender: { handle: '@institut.exemple', clue: null, infoKeys: [K(8, 'info1'), K(8, 'info2')] },
    body: [
      [{ t: K(8, 'a') }],
      [{ m: K(8, 'b'), clue: null }],
      [{ t: K(8, 'c') }]
    ]
  }
];

/** Totes les parts marcables d'un missatge, amb un identificador estable. */
export function markables(msg) {
  const out = [{ key: 'sender', clue: msg.sender.clue, kind: 'sender' }];
  if (msg.subject) out.push({ key: 'subject', clue: msg.subject.clue, kind: 'text' });
  msg.body.forEach((para, pi) => para.forEach((part, i) => {
    if ('m' in part) out.push({ key: `b${pi}.${i}`, clue: part.clue, kind: 'text' });
    if (part.link) out.push({ key: `b${pi}.${i}`, clue: part.clue, kind: 'link' });
  }));
  return out;
}

export function realClues(msg) {
  return markables(msg).filter((m) => m.clue);
}

export function allLinks() {
  return MESSAGES.flatMap((msg) => msg.body.flat().filter((p) => p.link).map((p) => ({ id: msg.id, url: p.link, label: p.label })));
}

export const PASS_CORRECT = 7;
export const MIN_CLUES = 2;
