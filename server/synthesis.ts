import OpenAI from 'openai';
import { CATEGORIES } from '../shared/research';
import type { SynthesisTheme } from '../shared/types';
import { config } from './config';
import { extractJsonObject } from './openaiResearch';

export type SynthesisInputTopic = {
  country_code: string;
  country_name_ja: string;
  region: string;
  category: string;
  importance_score: number;
  headline_ja: string;
  summary_ja: string;
};

export type SynthesisResult = {
  digest_ja: string;
  themes: SynthesisTheme[];
};

const SYNTHESIS_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['digest_ja', 'themes'],
  properties: {
    digest_ja: { type: 'string' },
    themes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title_ja', 'description_ja', 'country_codes', 'category'],
        properties: {
          title_ja: { type: 'string' },
          description_ja: { type: 'string' },
          country_codes: { type: 'array', items: { type: 'string' } },
          category: { type: ['string', 'null'] },
        },
      },
    },
  },
};

// 国別リサーチ結果を1回のLLM呼び出しで統合し、「今日の世界」ダイジェストと複数国にまたがるテーマを生成する。
export async function generateRunSynthesis(topics: SynthesisInputTopic[]): Promise<SynthesisResult> {
  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const response = await client.responses.create({
    model: config.openaiModel,
    reasoning: { effort: 'low' },
    text: {
      format: {
        type: 'json_schema' as const,
        name: 'world_lens_run_synthesis',
        strict: true,
        schema: SYNTHESIS_OUTPUT_SCHEMA,
      },
    },
    input: buildSynthesisPrompt(topics),
  });

  return parseSynthesisOutput(response.output_text ?? '');
}

export function buildSynthesisPrompt(topics: SynthesisInputTopic[]): string {
  // 入力トークンを抑えるため、重要度上位に絞って渡す。
  const limited = [...topics]
    .sort((a, b) => b.importance_score - a.importance_score)
    .slice(0, 48);

  const lines = limited.map(
    (topic) =>
      `- [${topic.country_code}] ${topic.country_name_ja}(${topic.region}) ${topic.category} 重要度${topic.importance_score}: ${topic.headline_ja} — ${topic.summary_ja}`,
  );

  return `
あなたは世界各国のニュースを横断的に読み解く編集者です。
以下は本日の国別リサーチ結果です。これを統合して「今日の世界ダイジェスト」と「横断テーマ」を作ってください。

国別リサーチ結果:
${lines.join('\n')}

要件:
- digest_ja: 3分で世界の変化を把握できる300〜450字の日本語。大国だけに偏らず、地域・国のバランスを取り、報道されにくい国の変化にも必ず触れてください。国名を明示してください。
- themes: 2〜6件。複数の国にまたがる共通テーマ(例: 通貨安、気候適応、選挙)を抽出してください。
  - title_ja: 20字程度のテーマ名
  - description_ja: どの国がどうつながるかを示す1-2文
  - country_codes: 関係する国のISOコード(必ず2か国以上。1か国だけのテーマは含めない)
  - category: ${CATEGORIES.join(' | ')} のいずれか。当てはまらなければ null

出力は説明文を付けず、JSONオブジェクトだけにしてください。
{
  "digest_ja": "...",
  "themes": [
    { "title_ja": "...", "description_ja": "...", "country_codes": ["NG", "MD"], "category": "経済" }
  ]
}
`;
}

export function parseSynthesisOutput(outputText: string): SynthesisResult {
  const jsonText = extractJsonObject(outputText);
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  const digest = typeof parsed.digest_ja === 'string' ? parsed.digest_ja.trim() : '';
  if (digest.length === 0) {
    throw new Error('Synthesis response did not contain digest_ja.');
  }

  const rawThemes = Array.isArray(parsed.themes) ? parsed.themes : [];
  const themes: SynthesisTheme[] = [];
  for (const rawTheme of rawThemes.slice(0, 6)) {
    const record = rawTheme && typeof rawTheme === 'object' ? (rawTheme as Record<string, unknown>) : {};
    const title = typeof record.title_ja === 'string' ? record.title_ja.trim() : '';
    const description = typeof record.description_ja === 'string' ? record.description_ja.trim() : '';
    const countryCodes = Array.isArray(record.country_codes)
      ? record.country_codes
          .filter((code): code is string => typeof code === 'string')
          .map((code) => code.trim().toUpperCase())
          .filter((code) => code.length > 0)
      : [];
    if (title.length === 0 || countryCodes.length < 2) {
      continue;
    }
    themes.push({
      title_ja: title,
      description_ja: description,
      country_codes: Array.from(new Set(countryCodes)),
      category: typeof record.category === 'string' && record.category.trim().length > 0 ? record.category.trim() : null,
    });
  }

  return { digest_ja: digest, themes };
}
