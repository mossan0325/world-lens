import type { Source } from './types';

// LLMが返す language は "en" / "English" / "日本語" など揺れるため、ISO風コードへ正規化する。
const LANGUAGE_ALIASES: Record<string, string> = {
  english: 'en',
  英語: 'en',
  japanese: 'ja',
  日本語: 'ja',
  french: 'fr',
  français: 'fr',
  francais: 'fr',
  フランス語: 'fr',
  german: 'de',
  deutsch: 'de',
  ドイツ語: 'de',
  spanish: 'es',
  español: 'es',
  espanol: 'es',
  スペイン語: 'es',
  portuguese: 'pt',
  português: 'pt',
  portugues: 'pt',
  ポルトガル語: 'pt',
  russian: 'ru',
  ロシア語: 'ru',
  arabic: 'ar',
  アラビア語: 'ar',
  romanian: 'ro',
  moldovan: 'ro',
  ルーマニア語: 'ro',
  dutch: 'nl',
  オランダ語: 'nl',
  swahili: 'sw',
  kiswahili: 'sw',
  スワヒリ語: 'sw',
  hindi: 'hi',
  ヒンディー語: 'hi',
  indonesian: 'id',
  'bahasa indonesia': 'id',
  インドネシア語: 'id',
  dzongkha: 'dz',
  ゾンカ語: 'dz',
  kyrgyz: 'ky',
  キルギス語: 'ky',
  georgian: 'ka',
  ジョージア語: 'ka',
  グルジア語: 'ka',
  maori: 'mi',
  māori: 'mi',
  マオリ語: 'mi',
  bislama: 'bi',
  ビスラマ語: 'bi',
  hausa: 'ha',
  ハウサ語: 'ha',
  yoruba: 'yo',
  ヨルバ語: 'yo',
  igbo: 'ig',
  イボ語: 'ig',
  chinese: 'zh',
  mandarin: 'zh',
  中国語: 'zh',
  korean: 'ko',
  韓国語: 'ko',
  turkish: 'tr',
  トルコ語: 'tr',
  ukrainian: 'uk',
  ウクライナ語: 'uk',
  italian: 'it',
  イタリア語: 'it',
};

export const LANGUAGE_LABELS_JA: Record<string, string> = {
  en: '英語',
  ja: '日本語',
  fr: 'フランス語',
  de: 'ドイツ語',
  es: 'スペイン語',
  pt: 'ポルトガル語',
  ru: 'ロシア語',
  ar: 'アラビア語',
  ro: 'ルーマニア語',
  nl: 'オランダ語',
  sw: 'スワヒリ語',
  hi: 'ヒンディー語',
  id: 'インドネシア語',
  dz: 'ゾンカ語',
  ky: 'キルギス語',
  ka: 'ジョージア語',
  mi: 'マオリ語',
  bi: 'ビスラマ語',
  ha: 'ハウサ語',
  yo: 'ヨルバ語',
  ig: 'イボ語',
  zh: '中国語',
  ko: '韓国語',
  tr: 'トルコ語',
  uk: 'ウクライナ語',
  it: 'イタリア語',
};

// 対象国の主な現地語(公用語・広域言語)。現地語ソース比率の判定に使う。
export const COUNTRY_LANGUAGES: Record<string, string[]> = {
  JP: ['ja'],
  US: ['en'],
  IN: ['hi', 'en'],
  ID: ['id'],
  BT: ['dz', 'en'],
  KG: ['ky', 'ru'],
  GE: ['ka', 'ru'],
  MD: ['ro', 'ru'],
  DE: ['de'],
  FR: ['fr'],
  NG: ['en', 'ha', 'yo', 'ig'],
  KE: ['sw', 'en'],
  GH: ['en'],
  CV: ['pt'],
  MX: ['es'],
  BR: ['pt'],
  SR: ['nl'],
  JO: ['ar'],
  NZ: ['en', 'mi'],
  VU: ['bi', 'en', 'fr'],
};

export function normalizeLanguage(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const raw = value.trim().toLowerCase();
  if (raw.length === 0) {
    return null;
  }
  const aliased = LANGUAGE_ALIASES[raw];
  if (aliased) {
    return aliased;
  }
  const primary = raw.split(/[-_]/)[0];
  if (/^[a-z]{2,3}$/.test(primary)) {
    return primary;
  }
  return LANGUAGE_ALIASES[primary] ?? null;
}

export function languageLabel(code: string): string {
  return LANGUAGE_LABELS_JA[code] ?? code.toUpperCase();
}

export function isLocalLanguage(countryCode: string, language: string | null | undefined): boolean {
  const normalized = normalizeLanguage(language);
  if (!normalized) {
    return false;
  }
  return (COUNTRY_LANGUAGES[countryCode] ?? []).includes(normalized);
}

// 言語情報を持つソースのうち現地語のものの比率。言語情報が1件もなければ null。
export function localSourceRatio(countryCode: string, sources: Pick<Source, 'language'>[]): number | null {
  const withLanguage = sources.filter((source) => normalizeLanguage(source.language));
  if (withLanguage.length === 0) {
    return null;
  }
  const localCount = withLanguage.filter((source) => isLocalLanguage(countryCode, source.language)).length;
  return localCount / withLanguage.length;
}
