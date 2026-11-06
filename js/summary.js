// Textos de resum (encerts per nivell, insignies) a partir de l'estat derivat.
// Rep la funció t() perquè el pugui fer servir també la pàgina docent.
import { BADGES, NO_HINTS_BADGE } from './derive.js';

export function scoreSummary(level, score = {}, t) {
  const yes = (b) => (b ? t('summary.yes') : t('summary.no'));
  switch (Number(level)) {
    case 0: return t('summary.l0', { found: score.found ?? 0, distractors: score.distractors ?? 0 });
    case 1: return t('summary.l1', { ok: score.classification ?? 0, phrase: yes(score.passphraseOk), len: score.passphraseLength ?? 0 });
    case 2: {
      const c = score.byChannel || {};
      return t('summary.l2', {
        ok: score.correct ?? 0, first: score.firstTry ?? 0, clues: score.cluesMarked ?? 0, links: score.linksClicked ?? 0,
        email: c.email ?? 0, sms: c.sms ?? 0, whatsapp: c.whatsapp ?? 0, instagram: c.instagram ?? 0
      });
    }
    case 3: return t('summary.l3', { data: score.dataFound ?? 0, measures: score.measuresOk ?? 0, steps: yes(score.stepsOk), totp: yes(score.totpOk) });
    case 4: return t('summary.l4', { dec: yes(score.decryptOk), enc: yes(score.encryptOk), tamper: yes(score.tamperDetected), quiz: yes(score.quizOk) });
    default: return '';
  }
}

export function badgeList(st, t, { emoji = true } = {}) {
  const out = st.badges.map((b) => (emoji ? t(`badges.${b}.icon`) + ' ' : '') + t(`badges.${b}.name`));
  if (st.noHintLevels.length) {
    out.push((emoji ? t(`badges.${NO_HINTS_BADGE}.icon`) + ' ' : '') + t(`badges.${NO_HINTS_BADGE}.name`) + ` ×${st.noHintLevels.length}`);
  }
  return out;
}

export function finalData(st) {
  return { totalPoints: st.points, badges: [...st.badges, ...(st.noHintLevels.length ? [NO_HINTS_BADGE] : [])], noHintLevels: st.noHintLevels };
}

export { BADGES };
