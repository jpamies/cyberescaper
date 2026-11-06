// Targetes encadenades (índex, esdeveniment, hash abreviat, hash anterior).
import { t } from './i18n.js';
import { h } from './ui.js';
import { shortHash } from './chain.js';

const EDITABLE = ['level', 'points', 'hintsUsed', 'attempts', 'hint', 'session', 'elapsedSec', 'penalty', 'totalPoints', 'alias', 'blocks'];

export function eventSummary(b) {
  const d = b.data || {};
  switch (b.type) {
    case 'genesis': return t('chainView.sum.genesis', { alias: d.alias, n: (d.members || []).length });
    case 'session_start': return t('chainView.sum.session_start', { s: d.session });
    case 'session_pause': return t('chainView.sum.session_pause', { s: d.session, min: Math.round((d.elapsedSec || 0) / 60) });
    case 'hint_used': return t('chainView.sum.hint_used', { level: d.level, n: d.hint });
    case 'level_completed': return t('chainView.sum.level_completed', { level: d.level, points: d.points });
    case 'overtime': return t('chainView.sum.overtime', { s: d.session, n: d.penalty });
    case 'import': return t('chainView.sum.import');
    case 'final': return t('chainView.sum.final', { points: d.totalPoints });
    default: return b.type;
  }
}

/**
 * opts.brokenFrom: índex a partir del qual la cadena està trencada (-1 = íntegra, null = no verificada)
 * opts.editable: si és true, mostra camps per modificar la CÒPIA; opts.onEdit(index, field, value)
 */
export function chainCards(chain, { brokenFrom = null, editable = false, onEdit } = {}) {
  const list = h('ol', { class: 'chain' });
  chain.forEach((b, i) => {
    const broken = brokenFrom !== null && brokenFrom !== -1 && i >= brokenFrom;
    const ok = brokenFrom !== null && !broken;
    const fields = editable ? EDITABLE.filter((k) => k in (b.data || {}) && typeof b.data[k] !== 'object') : [];
    list.append(h('li', { class: 'block' + (broken ? ' broken' : ok ? ' intact' : '') },
      h('div', { class: 'block-head' },
        h('strong', {}, t('chainView.block', { n: b.index })),
        brokenFrom !== null ? h('span', { class: 'block-status' }, broken ? '✖ ' + t('chainView.broken') : '✔ ' + t('chainView.intact')) : null),
      h('p', { class: 'block-type' }, t(`events.${b.type}`)),
      h('p', { class: 'small' }, eventSummary(b)),
      h('dl', { class: 'hashes' },
        h('dt', {}, t('chainView.hash')), h('dd', {}, h('code', {}, shortHash(b.hash, 12) + '…')),
        h('dt', {}, t('chainView.prev')), h('dd', {}, h('code', {}, shortHash(b.prevHash, 12) + '…'))),
      fields.length ? h('div', { class: 'block-edit' }, fields.map((k) => {
        const id = `edit-${i}-${k}`;
        const input = h('input', { id, value: String(b.data[k]), type: typeof b.data[k] === 'number' ? 'number' : 'text', class: 'small-input' });
        input.addEventListener('change', () => onEdit?.(i, k, typeof b.data[k] === 'number' ? Number(input.value) : input.value));
        return h('label', { for: id, class: 'edit-field' }, h('span', {}, k), input);
      })) : null
    ));
  });
  return list;
}
