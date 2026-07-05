import OpenAI from 'openai';
import { CATEGORIES } from '../shared/research';
import type { Country, Source } from '../shared/types';
import { config } from './config';
import type { ResearchPayload } from './repository';

type ParsedSource = Omit<Source, 'id' | 'update_id' | 'domain'>;

export type ResearchOptions = {
  // structured outputs(JSON Schema)が使えないモデル向けに、リトライ時はfalseで従来のテキスト抽出に落とす。
  structured?: boolean;
};

const RESEARCH_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['topics'],
  properties: {
    topics: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'topic_rank',
          'category',
          'importance_score',
          'headline_ja',
          'summary_ja',
          'why_it_matters_ja',
          'local_context_ja',
          'confidence',
          'sources',
        ],
        properties: {
          topic_rank: { type: 'integer' },
          category: { type: 'string', enum: [...CATEGORIES] },
          importance_score: { type: 'integer' },
          headline_ja: { type: 'string' },
          summary_ja: { type: 'string' },
          why_it_matters_ja: { type: 'string' },
          local_context_ja: { type: 'string' },
          confidence: { type: 'number' },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'url', 'language', 'published_at'],
              properties: {
                title: { type: 'string' },
                url: { type: 'string' },
                language: { type: ['string', 'null'] },
                published_at: { type: ['string', 'null'] },
              },
            },
          },
        },
      },
    },
  },
};

export async function researchCountry(
  country: Country,
  topics: string[],
  options: ResearchOptions = {},
): Promise<ResearchPayload[]> {
  const structured = options.structured ?? true;
  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const response = await client.responses.create({
    model: config.openaiModel,
    reasoning: { effort: 'medium' },
    tools: [{ type: 'web_search', search_context_size: config.searchContextSize }],
    tool_choice: 'required',
    include: ['web_search_call.action.sources'],
    ...(structured
      ? {
          text: {
            format: {
              type: 'json_schema' as const,
              name: 'world_lens_country_research',
              strict: true,
              schema: RESEARCH_OUTPUT_SCHEMA,
            },
          },
        }
      : {}),
    input: buildPrompt(country, topics),
  });

  const outputText = response.output_text ?? '';
  const parsed = parseResearchOutput(outputText);
  const citedSources = collectResponseSources(response);

  return parsed.map((topic) => ({
    ...topic,
    raw_json: JSON.stringify({ outputText, topic }),
    sources: mergeSources(topic.sources, citedSources),
  }));
}

export function buildPrompt(country: Country, topics: string[]): string {
  return `
あなたは世界各国の変化を横断的に把握するリサーチエージェントです。
Responses API の web_search を使って、次の国について直近24-72時間を中心に重要な変化を調べてください。

国:
- 日本語名: ${country.name_ja}
- 英語名: ${country.name_en}
- 地域: ${country.region}

注目トピック:
${topics.map((topic) => `- ${topic}`).join('\n')}

調査方針:
- その国の現地語または現地メディア、政府・国際機関・主要報道を優先してください。
- 日本の主要メディアだけに偏らないでください。
- 可能な限り現地語のソースを1件以上含め、各ソースの language を必ず記入してください。
- 大きな事件だけでなく、小国・地域で後から意味を持ち得る制度、経済、社会、災害、外交、資源の変化を拾ってください。
- 主要トピックが複数ある場合は複数返してください。
- ただし無理に数を増やさず、主要トピックが1件だけなら1件で構いません。
- 最大3件までにしてください。
- 不確実な情報は断定せず、confidence を下げてください。

importance_score の基準(国の大きさではなく「変化の大きさ」を、全ての国に共通の物差しで採点):
- 85-100: 国の進路を左右する、または国境を越えて波及し得る重大な変化(政変、大災害、重大な制度転換など)
- 70-84: 全国規模の影響があり、数か月内に政策・市場・生活へ波及し得る変化
- 50-69: 特定分野・地域で進行中の重要な変化や、後から意味を持ち得る兆候
- 1-49: 継続的な動向・小さな変化

出力は説明文を付けず、次のJSONオブジェクトだけにしてください。
{
  "topics": [
    {
      "topic_rank": 1,
      "category": "${CATEGORIES.join(' | ')} のいずれか1つ",
      "importance_score": 1から100の整数,
      "headline_ja": "30字程度の日本語見出し",
      "summary_ja": "何が起きたか、誰に影響するか、直近の変化点が分かる2文以内の日本語要約",
      "why_it_matters_ja": "世界を横断的に理解するうえで重要な理由を1-2文で簡潔に説明",
      "local_context_ja": "現地文脈や現地語ソースから見える補足を1-2文で簡潔に説明",
      "confidence": 0から1の数値,
      "sources": [
        { "title": "出典タイトル", "url": "https://...", "language": "言語コードまたは言語名", "published_at": "分かる場合のみISO日付、無ければnull" }
      ]
    }
  ]
}
`;
}

export function parseResearchOutput(outputText: string): ResearchPayload[] {
  const jsonText = extractJsonObject(outputText);
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  const rawTopics = Array.isArray(parsed.topics) ? parsed.topics.slice(0, 3) : [parsed];
  const normalizedTopics = rawTopics
    .map((topic, index) => normalizeTopic(topic, index + 1))
    .filter((topic): topic is ResearchPayload => Boolean(topic));

  if (normalizedTopics.length === 0) {
    throw new Error('OpenAI response did not contain any research topics.');
  }

  return normalizedTopics.map((topic, index) => ({
    ...topic,
    topic_rank: index + 1,
    raw_json: jsonText,
  }));
}

function normalizeTopic(value: unknown, fallbackRank: number): ResearchPayload | null {
  const record = asRecord(value);
  if (Object.keys(record).length === 0) {
    return null;
  }
  const sources = Array.isArray(record.sources)
    ? record.sources.map(normalizeSource).filter((source): source is ParsedSource => Boolean(source))
    : [];

  return {
    topic_rank: clampInteger(record.topic_rank, 1, 3, fallbackRank),
    category: readString(record.category, '国別動向'),
    importance_score: clampInteger(record.importance_score, 1, 100, 50),
    headline_ja: readString(record.headline_ja, '重要な変化を検出'),
    summary_ja: readString(record.summary_ja, '要約を取得できませんでした。'),
    why_it_matters_ja: readString(record.why_it_matters_ja, '横断比較のため追加確認が必要です。'),
    local_context_ja: readString(record.local_context_ja, '現地文脈は追加調査が必要です。'),
    confidence: clampNumber(record.confidence, 0, 1, 0.5),
    raw_json: JSON.stringify(record),
    sources,
  };
}

export function collectResponseSources(response: unknown): ParsedSource[] {
  const root = asRecord(response);
  const output = Array.isArray(root.output) ? root.output : [];
  const sources: ParsedSource[] = [];

  for (const item of output) {
    const record = asRecord(item);
    const action = asRecord(record.action);
    if (Array.isArray(action.sources)) {
      for (const source of action.sources) {
        const normalized = normalizeSource(source);
        if (normalized) {
          sources.push(normalized);
        }
      }
    }

    const content = Array.isArray(record.content) ? record.content : [];
    for (const contentItem of content) {
      const contentRecord = asRecord(contentItem);
      const annotations = Array.isArray(contentRecord.annotations) ? contentRecord.annotations : [];
      for (const annotation of annotations) {
        const annotationRecord = asRecord(annotation);
        if (annotationRecord.type === 'url_citation') {
          const normalized = normalizeSource({
            title: annotationRecord.title,
            url: annotationRecord.url,
          });
          if (normalized) {
            sources.push(normalized);
          }
        }
      }
    }
  }

  return dedupeSources(sources);
}

export function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('OpenAI response did not contain a JSON object.');
  }
  return candidate.slice(start, end + 1);
}

function normalizeSource(value: unknown): ParsedSource | null {
  const record = asRecord(value);
  const url = readOptionalString(record.url);
  if (!url) {
    return null;
  }
  return {
    title: readOptionalString(record.title) ?? url,
    url,
    language: readOptionalString(record.language),
    published_at: readOptionalString(record.published_at),
    citation_index: typeof record.citation_index === 'number' ? record.citation_index : null,
  };
}

function mergeSources(primary: ParsedSource[], secondary: ParsedSource[]): ParsedSource[] {
  return dedupeSources([...primary, ...secondary]).slice(0, 8);
}

function dedupeSources(sources: ParsedSource[]): ParsedSource[] {
  const seen = new Set<string>();
  const deduped: ParsedSource[] = [];
  for (const source of sources) {
    if (seen.has(source.url)) {
      continue;
    }
    seen.add(source.url);
    deduped.push(source);
  }
  return deduped;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const numberValue = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(numberValue)));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numberValue = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, numberValue));
}
