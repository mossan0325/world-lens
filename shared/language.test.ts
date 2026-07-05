import { describe, expect, it } from 'vitest';
import { isLocalLanguage, languageLabel, localSourceRatio, normalizeLanguage } from './language';

describe('language normalization', () => {
  it('normalizes names, aliases, and region suffixes', () => {
    expect(normalizeLanguage('English')).toBe('en');
    expect(normalizeLanguage('en-US')).toBe('en');
    expect(normalizeLanguage('日本語')).toBe('ja');
    expect(normalizeLanguage('Français')).toBe('fr');
    expect(normalizeLanguage('pt')).toBe('pt');
  });

  it('returns null for empty or unknown values', () => {
    expect(normalizeLanguage('')).toBeNull();
    expect(normalizeLanguage(null)).toBeNull();
    expect(normalizeLanguage('unknownlanguage')).toBeNull();
  });

  it('labels known codes in Japanese', () => {
    expect(languageLabel('dz')).toBe('ゾンカ語');
    expect(languageLabel('xx')).toBe('XX');
  });
});

describe('local language detection', () => {
  it('detects local sources per country', () => {
    expect(isLocalLanguage('BT', 'Dzongkha')).toBe(true);
    expect(isLocalLanguage('BT', 'en')).toBe(true);
    expect(isLocalLanguage('BT', 'fr')).toBe(false);
    expect(isLocalLanguage('MD', 'ルーマニア語')).toBe(true);
  });

  it('computes local source ratio, ignoring sources without language', () => {
    expect(localSourceRatio('JP', [{ language: null }, { language: undefined }])).toBeNull();
    expect(
      localSourceRatio('JP', [{ language: 'ja' }, { language: 'en' }, { language: null }]),
    ).toBeCloseTo(0.5);
  });
});
