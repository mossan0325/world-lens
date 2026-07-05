import type { Country } from './types';

export const COUNTRIES: Country[] = [
  { code: 'JP', name_ja: '日本', name_en: 'Japan', region: 'アジア', lat: 36.2, lng: 138.2, rarity_tier: 'anchor' },
  { code: 'US', name_ja: '米国', name_en: 'United States', region: '北米', lat: 39.8, lng: -98.6, rarity_tier: 'anchor' },
  { code: 'IN', name_ja: 'インド', name_en: 'India', region: 'アジア', lat: 20.6, lng: 78.9, rarity_tier: 'anchor' },
  { code: 'ID', name_ja: 'インドネシア', name_en: 'Indonesia', region: 'アジア', lat: -2.5, lng: 118.0, rarity_tier: 'regional' },
  { code: 'BT', name_ja: 'ブータン', name_en: 'Bhutan', region: 'アジア', lat: 27.5, lng: 90.4, rarity_tier: 'rare' },
  { code: 'KG', name_ja: 'キルギス', name_en: 'Kyrgyzstan', region: 'アジア', lat: 41.2, lng: 74.8, rarity_tier: 'rare' },
  { code: 'GE', name_ja: 'ジョージア', name_en: 'Georgia', region: '欧州', lat: 42.3, lng: 43.4, rarity_tier: 'rare' },
  { code: 'MD', name_ja: 'モルドバ', name_en: 'Moldova', region: '欧州', lat: 47.0, lng: 28.4, rarity_tier: 'rare' },
  { code: 'DE', name_ja: 'ドイツ', name_en: 'Germany', region: '欧州', lat: 51.2, lng: 10.4, rarity_tier: 'anchor' },
  { code: 'FR', name_ja: 'フランス', name_en: 'France', region: '欧州', lat: 46.2, lng: 2.2, rarity_tier: 'anchor' },
  { code: 'NG', name_ja: 'ナイジェリア', name_en: 'Nigeria', region: '中東・アフリカ', lat: 9.1, lng: 8.7, rarity_tier: 'anchor' },
  { code: 'KE', name_ja: 'ケニア', name_en: 'Kenya', region: '中東・アフリカ', lat: -0.0, lng: 37.9, rarity_tier: 'regional' },
  { code: 'GH', name_ja: 'ガーナ', name_en: 'Ghana', region: '中東・アフリカ', lat: 7.9, lng: -1.0, rarity_tier: 'regional' },
  { code: 'CV', name_ja: 'カーボベルデ', name_en: 'Cabo Verde', region: '中東・アフリカ', lat: 16.0, lng: -24.0, rarity_tier: 'rare' },
  { code: 'MX', name_ja: 'メキシコ', name_en: 'Mexico', region: '北米', lat: 23.6, lng: -102.5, rarity_tier: 'regional' },
  { code: 'BR', name_ja: 'ブラジル', name_en: 'Brazil', region: '中南米', lat: -14.2, lng: -51.9, rarity_tier: 'anchor' },
  { code: 'SR', name_ja: 'スリナム', name_en: 'Suriname', region: '中南米', lat: 3.9, lng: -56.0, rarity_tier: 'rare' },
  { code: 'JO', name_ja: 'ヨルダン', name_en: 'Jordan', region: '中東・アフリカ', lat: 31.2, lng: 36.5, rarity_tier: 'regional' },
  { code: 'NZ', name_ja: 'ニュージーランド', name_en: 'New Zealand', region: '太平洋', lat: -40.9, lng: 174.9, rarity_tier: 'regional' },
  { code: 'VU', name_ja: 'バヌアツ', name_en: 'Vanuatu', region: '太平洋', lat: -15.4, lng: 166.9, rarity_tier: 'rare' },
];

export const REGIONS = ['全世界', 'アジア', '欧州', '中東・アフリカ', '北米', '中南米', '太平洋'];
