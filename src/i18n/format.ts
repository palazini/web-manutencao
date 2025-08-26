// src/i18n/format.ts
import i18n from '../i18n';

/** Normaliza o código atual (mantém scripts do chinês). */
export function normLang(lng?: string): string {
  const raw = (lng ?? i18n.resolvedLanguage ?? i18n.language ?? 'pt').toString();

  // Chinês: preserve script (Hans/Hant)
  if (/^zh/i.test(raw)) {
    if (/hant/i.test(raw) || /-(tw|hk|mo)/i.test(raw)) return 'zh-Hant';
    return 'zh-Hans';
  }

  // Demais: volte ao idioma base (pt-BR -> pt, en-GB -> en)
  return raw.split('-')[0];
}

/** Locale para Intl.DateTimeFormat / Intl.NumberFormat. */
export function locale(): string {
  switch (normLang()) {
    case 'pt':      return 'pt-BR';
    case 'es':      return 'es-ES';
    case 'en':      return 'en-US';
    case 'de':      return 'de-DE';
    case 'fr':      return 'fr-FR';
    case 'it':      return 'it-IT';
    case 'zh-Hans': return 'zh-CN'; // Simplificado
    case 'zh-Hant': return 'zh-TW'; // Tradicional
    case 'ja':      return 'ja-JP';
    case 'ko':      return 'ko-KR';
    default:        return 'en-US';
  }
}

/** Date formatter (Intl) */
export const df = (
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'short' }
) => new Intl.DateTimeFormat(locale(), opts);

/** Number formatter (Intl) */
export const nf = (opts: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat(locale(), opts);

/** Currency formatter (Intl) com moeda padrão por idioma */
export const cf = (
  currency?: string,
  opts: Intl.NumberFormatOptions = {}
) => {
  const lang = normLang();
  const fallback =
    lang === 'pt'      ? 'BRL' :
    lang === 'es'      ? 'EUR' :
    lang === 'en'      ? 'USD' :
    lang === 'de'      ? 'EUR' :
    lang === 'fr'      ? 'EUR' :
    lang === 'it'      ? 'EUR' :
    lang === 'zh-Hans' ? 'CNY' :
    lang === 'zh-Hant' ? 'TWD' :
    lang === 'ja'      ? 'JPY' :
    lang === 'ko'      ? 'KRW' :
                         'USD';
  return new Intl.NumberFormat(locale(), {
    style: 'currency',
    currency: currency || fallback,
    ...opts
  });
};

/**
 * Converte um rótulo de status (em PT/ES/EN/DE/FR/IT/ZH) para a key estável
 * usada nas traduções: 'open' | 'in_progress' | 'closed' | 'cancelled'
 * (O Firestore pode estar em PT, mas deixamos robusto.)
 */
export const statusKey = (value: string): 'open' | 'in_progress' | 'closed' | 'cancelled' => {
  const v = (value || '').trim();

  // PT
  if (v === 'Aberto')        return 'open';
  if (v === 'Em Andamento')  return 'in_progress';
  if (v === 'Concluído')     return 'closed';
  if (v === 'Cancelado')     return 'cancelled';

  // ES
  if (v === 'Abierta' || v === 'Abierto') return 'open';
  if (v === 'En Curso')                    return 'in_progress';
  if (v === 'Concluida' || v === 'Concluida' || v === 'Concluida') return 'closed';
  if (v === 'Cancelada' || v === 'Cancelado')                       return 'cancelled';

  // EN
  if (v === 'Open')         return 'open';
  if (v === 'In Progress')  return 'in_progress';
  if (v === 'Closed')       return 'closed';
  if (v === 'Cancelled')    return 'cancelled';

  // DE
  if (v === 'Offen')             return 'open';
  if (v === 'In Bearbeitung')    return 'in_progress';
  if (v === 'Abgeschlossen')     return 'closed';
  if (v === 'Storniert')         return 'cancelled';

  // FR
  if (v === 'Ouvrte' || v === 'Ouverte') return 'open';
  if (v === 'En cours')                  return 'in_progress';
  if (v === 'Terminée' || v === 'Terminee') return 'closed';
  if (v === 'Annulée' || v === 'Annulee')   return 'cancelled';

  // IT
  if (v === 'Aperta')         return 'open';
  if (v === 'In Corso')       return 'in_progress';
  if (v === 'Conclusa')       return 'closed';
  if (v === 'Annullata')      return 'cancelled';

  // ZH — Simplificado / Tradicional
  if (v === '打开' || v === '開啟')           return 'open';
  if (v === '进行中' || v === '進行中')       return 'in_progress';
  if (v === '已完成')                         return 'closed';
  if (v === '已取消')                         return 'cancelled';

  // JP
  if (v === 'オープン')   return 'open';
  if (v === '進行中')     return 'in_progress';
  if (v === '完了')       return 'closed';
  if (v === 'キャンセル' || v === '取り消し' || v === '取消') return 'cancelled';

  //KO
  if (v === '오픈' || v === '열림')   return 'open';
  if (v === '진행 중' || v === '진행중') return 'in_progress';
  if (v === '완료')                   return 'closed';
  if (v === '취소' || v === '취소됨')  return 'cancelled';

  // fallback
  return 'open';
};

/** Formata Firestore Timestamp/Date/string numérica no locale atual. */
export const formatTS = (
  ts: any,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' }
) => {
  if (!ts) return '';
  const d =
    typeof ts?.toDate === 'function' ? ts.toDate() :
    ts instanceof Date ? ts :
    new Date(ts);
  if (Number.isNaN(+d)) return '';
  return new Intl.DateTimeFormat(locale(), opts).format(d);
};
