// Informe PDF generat al navegador amb jsPDF (vendor/), sense servidor.
// Fa servir Helvetica/Courier (codificació WinAnsi), que inclouen à, ç, l·l, ñ...
import { t, getLang } from './i18n.js';
import { loadScript } from './ui.js';
import { verifyChain, shortHash } from './chain.js';
import { deriveState, LEVEL_COUNT, LEVEL_POINTS } from './derive.js';
import { encodeCode, splitLines } from './codec.js';
import { scoreSummary, badgeList } from './summary.js';

const QR_MAX_BYTES = 2900; // capacitat aproximada d'un QR versió 40, correcció L

// Caràcters que Helvetica (WinAnsi) pot dibuixar; la resta (emojis...) se substitueix.
const WIN1252_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
export function pdfSafe(text) {
  return [...String(text ?? '')].map((ch) => {
    const c = ch.codePointAt(0);
    if (c === 0x0a || (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN1252_EXTRA.includes(ch)) return ch;
    if (ch === '→') return '->';
    if (c === 0x2713 || c === 0x2714) return 'OK';
    if (c >= 0xfe00 && c <= 0xfe0f) return '';
    if (c === 0x200d) return '';
    return c > 0xffff || (c >= 0x2600 && c <= 0x27bf) ? '' : '?';
  }).join('').replace(/ {2,}/g, ' ');
}

function fmtDateTime(iso, lang) {
  const d = new Date(iso);
  return d.toLocaleString(lang === 'es' ? 'es-ES' : 'ca-ES', { dateStyle: 'short', timeStyle: 'medium' });
}

export async function generatePdf(exportObj) {
  await loadScript('vendor/jspdf.umd.min.js');
  await loadScript('vendor/qrcode.js');
  const { jsPDF } = window.jspdf;
  const lang = getLang();
  const { header, chain } = exportObj;
  const st = deriveState(chain, Date.parse(header.generatedAt));
  const broken = await verifyChain(chain);
  const code = await encodeCode(exportObj);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `CyberEscaper · ${header.alias}`, subject: t('pdf.subject'), creator: 'CyberEscaper ' + header.version });
  const W = 210, M = 16, BOTTOM = 280;
  let y = M;

  const font = (style = 'normal', size = 10, family = 'helvetica') => { doc.setFont(family, style); doc.setFontSize(size); };
  const need = (hgt) => { if (y + hgt > BOTTOM) { doc.addPage(); y = M; } };
  const para = (text, { size = 10, style = 'normal', family = 'helvetica', gap = 1.5, width = W - 2 * M, x = M } = {}) => {
    font(style, size, family);
    const lines = doc.splitTextToSize(pdfSafe(text), width);
    const lh = size * 0.42;
    for (const line of lines) { need(lh); doc.text(line, x, y + lh * 0.8); y += lh; }
    y += gap;
  };
  const heading = (text) => { need(14); y += 3; para(text, { size: 14, style: 'bold', gap: 2 }); doc.setDrawColor(30, 90, 200); doc.line(M, y - 1.5, W - M, y - 1.5); y += 2; };

  // Taula senzilla amb salts de pàgina i ajust de text
  const table = (cols, rows, { size = 8.5, family = 'helvetica' } = {}) => {
    const lh = size * 0.42;
    const drawRow = (cells, bold, fill) => {
      font(bold ? 'bold' : 'normal', size, bold ? 'helvetica' : family);
      const wrapped = cells.map((c, i) => doc.splitTextToSize(pdfSafe(c), cols[i].w - 2));
      const hgt = Math.max(...wrapped.map((w) => w.length)) * lh + 2;
      if (y + hgt > BOTTOM) { doc.addPage(); y = M; if (!bold) drawRow(cols.map((c) => c.label), true, true); font('normal', size, family); }
      let x = M;
      if (fill) { doc.setFillColor(225, 234, 250); doc.rect(M, y, cols.reduce((a, c) => a + c.w, 0), hgt, 'F'); }
      wrapped.forEach((lines, i) => {
        lines.forEach((line, j) => doc.text(line, x + 1, y + 1 + lh * (j + 0.8)));
        x += cols[i].w;
      });
      doc.setDrawColor(180, 190, 210);
      doc.line(M, y + hgt, x, y + hgt);
      y += hgt;
    };
    drawRow(cols.map((c) => c.label), true, true);
    rows.forEach((r) => drawRow(r, false, false));
    y += 3;
  };

  // --- Portada ---------------------------------------------------------------
  doc.setFillColor(11, 18, 32);
  doc.rect(0, 0, W, 48, 'F');
  doc.setTextColor(255, 255, 255);
  font('bold', 22); doc.text('CyberEscaper 4.0', M, 20);
  font('normal', 12); doc.text(pdfSafe(t('pdf.title')), M, 30);
  font('normal', 9); doc.text(pdfSafe(t('pdf.subtitle')), M, 38);
  doc.setTextColor(0, 0, 0);
  y = 60;
  para(`${t('pdf.alias')}: ${header.alias}`, { size: 16, style: 'bold' });
  para(`${t('pdf.date')}: ${fmtDateTime(header.generatedAt, lang)}`, { size: 11 });
  para(`${t('pdf.points')}: ${st.points}`, { size: 11 });
  para(`${t('pdf.levels')}: ${Object.keys(st.completed).length} / ${LEVEL_COUNT}`, { size: 11 });
  para(`${t('pdf.badges')}: ${badgeList(st, t, { emoji: false }).join(', ') || '—'}`, { size: 11 });
  para(`${t('pdf.members')}: ${st.team.members.map((m) => t(`roles.${m.role}`) + ' (' + t(`specialties.${m.specialty}`) + ')').join(' · ')}`, { size: 10 });
  y += 4;
  const ok = broken === -1;
  doc.setDrawColor(ok ? 20 : 180, ok ? 120 : 20, ok ? 60 : 20);
  doc.setLineWidth(0.8);
  doc.rect(M, y, W - 2 * M, 16);
  doc.setLineWidth(0.2);
  font('bold', 13);
  doc.text(pdfSafe(ok ? t('pdf.intact') : t('pdf.tampered', { n: broken })), M + 5, y + 10);
  y += 22;
  para(t('pdf.howToVerify'), { size: 9 });

  // --- Nivells ---------------------------------------------------------------
  doc.addPage(); y = M;
  heading(t('pdf.levelsTitle'));
  table(
    [{ label: t('pdf.colLevel'), w: 42 }, { label: t('pdf.colScore'), w: 76 }, { label: t('pdf.colHints'), w: 18 }, { label: t('pdf.colAttempts'), w: 18 }, { label: t('pdf.colPoints'), w: 24 }],
    Array.from({ length: LEVEL_COUNT }, (_, l) => {
      const c = st.completed[l];
      return [
        `${l} · ${t(`level${l}.title`)}`,
        c ? scoreSummary(l, c.score, t) : t('pdf.notCompleted'),
        String(st.hints[l].length),
        c ? String(c.attempts) : '—',
        c ? `${c.points} / ${LEVEL_POINTS[l]}` : '—'
      ];
    })
  );
  heading(t('pdf.reportsTitle'));
  for (let l = 0; l < LEVEL_COUNT; l++) {
    const c = st.completed[l];
    para(`${t('pdf.level')} ${l} · ${t(`level${l}.title`)}`, { style: 'bold', size: 10, gap: 0.5 });
    para(c ? c.report : t('pdf.notCompleted'), { size: 9.5, gap: 3 });
  }
  heading(t('pdf.sessionsTitle'));
  for (const s of [2, 3, 4]) {
    const ses = st.sessions[s];
    para(`${t('pdf.session')} ${s}: ${ses.started ? Math.round(ses.elapsedSec / 60) + ' min' : '—'}${s in st.overtime ? ' · ' + t('pdf.overtime') : ''}${ses.completed ? ' · ' + t('pdf.completed') : ''} · ${t('pdf.hintsInSession')}: ${st.hintsBySession[s] || 0}`, { size: 9.5, gap: 0.5 });
  }

  // --- Cadena ----------------------------------------------------------------
  doc.addPage(); y = M;
  heading(t('pdf.chainTitle'));
  para(t('pdf.chainExplain'), { size: 9 });
  table(
    [{ label: '#', w: 10 }, { label: t('pdf.colType'), w: 46 }, { label: t('pdf.colTime'), w: 44 }, { label: t('pdf.colHash'), w: 39 }, { label: t('pdf.colPrev'), w: 39 }],
    chain.map((b) => [String(b.index), t(`events.${b.type}`), fmtDateTime(b.timestamp, lang), shortHash(b.hash, 16), shortHash(b.prevHash, 16)]),
    { family: 'courier', size: 8 }
  );

  // --- Codi de verificació ---------------------------------------------------
  doc.addPage(); y = M;
  heading(t('pdf.codeTitle'));
  para(t('pdf.codeExplain'), { size: 9 });
  for (const line of splitLines(code, 88)) para(line, { family: 'courier', size: 7.5, gap: 0 });
  y += 4;
  let qrOk = false;
  if (code.length <= QR_MAX_BYTES && window.qrcode) {
    try {
      const qr = window.qrcode(0, 'L');
      qr.addData(code, 'Byte');
      qr.make();
      const n = qr.getModuleCount();
      const size = Math.min(150, W - 2 * M);
      if (y + size + 10 > BOTTOM) { doc.addPage(); y = M; }
      const cell = size / n;
      const x0 = (W - size) / 2;
      doc.setFillColor(0, 0, 0);
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) doc.rect(x0 + c * cell, y + r * cell, cell, cell, 'F');
      y += size + 4;
      para(t('pdf.qrNote'), { size: 8.5 });
      qrOk = true;
    } catch { qrOk = false; }
  }
  if (!qrOk) para(t('pdf.qrTooBig'), { size: 9, style: 'italic' });

  // --- Peu de pàgina a totes les pàgines -------------------------------------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    font('normal', 8);
    doc.setTextColor(90, 90, 90);
    doc.text(pdfSafe(t('pdf.footer')), M, 290);
    doc.text(`${p} / ${pages}`, W - M, 290, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }
  return doc.output('blob');
}
