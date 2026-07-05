import { describe, expect, it } from 'vitest';
import { buildSynthesisPrompt, parseSynthesisOutput } from './synthesis';

describe('synthesis output parsing', () => {
  it('parses digest and multi-country themes', () => {
    const result = parseSynthesisOutput(`
      \`\`\`json
      {
        "digest_ja": "今日の世界では通貨と気候の課題が並行して進んだ。",
        "themes": [
          {
            "title_ja": "通貨安の連鎖",
            "description_ja": "ナイジェリアとモルドバで物価上昇が生活に波及した。",
            "country_codes": ["ng", "MD", "NG"],
            "category": "経済"
          },
          {
            "title_ja": "単独テーマ",
            "description_ja": "1か国だけのテーマは除外される。",
            "country_codes": ["JP"],
            "category": null
          }
        ]
      }
      \`\`\`
    `);

    expect(result.digest_ja).toContain('通貨と気候');
    expect(result.themes).toHaveLength(1);
    expect(result.themes[0]?.country_codes).toEqual(['NG', 'MD']);
    expect(result.themes[0]?.category).toBe('経済');
  });

  it('throws when digest is missing', () => {
    expect(() => parseSynthesisOutput('{"themes": []}')).toThrow();
  });

  it('builds a prompt that lists topics with country codes', () => {
    const prompt = buildSynthesisPrompt([
      {
        country_code: 'BT',
        country_name_ja: 'ブータン',
        region: 'アジア',
        category: '災害・気候',
        importance_score: 76,
        headline_ja: '山岳気候リスク',
        summary_ja: '要約。',
      },
    ]);
    expect(prompt).toContain('[BT] ブータン');
    expect(prompt).toContain('digest_ja');
  });
});
