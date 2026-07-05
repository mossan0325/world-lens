import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { COUNTRIES } from '../shared/countries';
import { config } from './config';

export type WorldLensDatabase = Database.Database;

export function openWorldLensDatabase(dbPath = config.dbPath): WorldLensDatabase {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  // CLI(npm run research)とAPIサーバーが同じDBに書き込むことがあるため待機を許容する。
  db.pragma('busy_timeout = 5000');
  initializeSchema(db);
  seedCountries(db);
  seedDemoData(db);
  return db;
}

function initializeSchema(db: WorldLensDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS countries (
      code TEXT PRIMARY KEY,
      name_ja TEXT NOT NULL,
      name_en TEXT NOT NULL,
      region TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      rarity_tier TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS research_runs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      model TEXT NOT NULL,
      topics_json TEXT NOT NULL,
      country_count INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS country_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL REFERENCES research_runs(id),
      country_code TEXT NOT NULL REFERENCES countries(code),
      topic_rank INTEGER NOT NULL DEFAULT 1,
      category TEXT NOT NULL,
      importance_score INTEGER NOT NULL,
      headline_ja TEXT NOT NULL,
      summary_ja TEXT NOT NULL,
      why_it_matters_ja TEXT NOT NULL,
      local_context_ja TEXT NOT NULL,
      confidence REAL NOT NULL,
      raw_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      update_id INTEGER NOT NULL REFERENCES country_updates(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      domain TEXT NOT NULL,
      language TEXT,
      published_at TEXT,
      citation_index INTEGER
    );

    CREATE TABLE IF NOT EXISTS research_run_countries (
      run_id TEXT NOT NULL REFERENCES research_runs(id),
      country_code TEXT NOT NULL REFERENCES countries(code),
      status TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      error TEXT,
      PRIMARY KEY (run_id, country_code)
    );

    CREATE TABLE IF NOT EXISTS run_synthesis (
      run_id TEXT PRIMARY KEY REFERENCES research_runs(id),
      digest_ja TEXT NOT NULL,
      themes_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_country_updates_run ON country_updates(run_id);
    CREATE INDEX IF NOT EXISTS idx_country_updates_country ON country_updates(country_code, created_at);
    CREATE INDEX IF NOT EXISTS idx_run_countries_run ON research_run_countries(run_id);
    CREATE INDEX IF NOT EXISTS idx_sources_update ON sources(update_id);
  `);
  ensureColumn(db, 'country_updates', 'topic_rank', 'INTEGER NOT NULL DEFAULT 1');
}

function seedCountries(db: WorldLensDatabase): void {
  const insert = db.prepare(`
    INSERT INTO countries (code, name_ja, name_en, region, lat, lng, rarity_tier)
    VALUES (@code, @name_ja, @name_en, @region, @lat, @lng, @rarity_tier)
    ON CONFLICT(code) DO UPDATE SET
      name_ja = excluded.name_ja,
      name_en = excluded.name_en,
      region = excluded.region,
      lat = excluded.lat,
      lng = excluded.lng,
      rarity_tier = excluded.rarity_tier
  `);

  const transaction = db.transaction(() => {
    for (const country of COUNTRIES) {
      insert.run(country);
    }
  });

  transaction();
}

function seedDemoData(db: WorldLensDatabase): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO research_runs (id, status, model, topics_json, country_count, started_at, finished_at, error)
    VALUES ('seed-demo', 'completed', 'demo-seed', '["政治・規制","経済","社会"]', 20, @now, @now, NULL)
  `).run({ now });

  const samples = [
    {
      country_code: 'NG',
      topic_rank: 1,
      category: '経済・通貨',
      importance_score: 91,
      headline_ja: '通貨安と外貨準備をめぐる市場警戒が再燃',
      summary_ja: 'ナイジェリアでは通貨ナイラの変動と輸入コスト上昇が、家計・企業の判断に影響している可能性がある。',
      why_it_matters_ja: '資源国の通貨変動は、食料価格、周辺国貿易、対外投資のリスク評価に波及しやすい。',
      local_context_ja: '現地報道では生活物価と中小企業の資金繰りがセットで語られやすい。',
      confidence: 0.72,
      sources: [
        { title: 'Demo source: Nigeria market monitor', url: 'https://example.com/nigeria-market', language: 'en' },
        { title: 'Demo source: Kasuwanni da farashin kaya (ハウサ語)', url: 'https://example.com/nigeria-hausa-market', language: 'ha' },
      ],
    },
    {
      country_code: 'NG',
      topic_rank: 2,
      category: '社会・生活',
      importance_score: 83,
      headline_ja: '食品価格上昇への生活者負担が拡大',
      summary_ja: '通貨安と物流費の上昇により、都市部と地方の生活費負担が強まっている。',
      why_it_matters_ja: '生活物価の変化は政治的安定、消費市場、周辺国への移動に影響しやすい。',
      local_context_ja: '現地では為替そのものより、食料品と燃料価格の体感負担が語られやすい。',
      confidence: 0.69,
      sources: [{ title: 'Demo source: Nigeria cost of living brief', url: 'https://example.com/nigeria-cost-living', language: 'en' }],
    },
    {
      country_code: 'BT',
      topic_rank: 1,
      category: '社会・気候',
      importance_score: 76,
      headline_ja: '山岳地域の気候リスクと観光回復が同時に注目',
      summary_ja: 'ブータンでは観光回復への期待と、山岳インフラ・水資源への気候影響が並行して議論されている。',
      why_it_matters_ja: '小国の政策変化は大きく報じられにくいが、持続可能な観光や気候適応の先行事例になり得る。',
      local_context_ja: '地域文脈では、経済回復だけでなく幸福・環境保全とのバランスが重視される。',
      confidence: 0.66,
      sources: [
        { title: 'Demo source: Bhutan local brief', url: 'https://example.com/bhutan-climate-tourism', language: 'en' },
        { title: 'Demo source: 山岳気候レポート (ゾンカ語)', url: 'https://example.com/bhutan-dzongkha-report', language: 'dz' },
      ],
    },
    {
      country_code: 'MD',
      topic_rank: 1,
      category: '政治・安全保障',
      importance_score: 84,
      headline_ja: '欧州統合とエネルギー安全保障をめぐる議論が継続',
      summary_ja: 'モルドバでは欧州との制度接近、エネルギー調達、地域安全保障の論点が重なっている。',
      why_it_matters_ja: '欧州周縁国の制度変更は、EU拡大、送電網、移民政策の観測点になる。',
      local_context_ja: '国内政治では改革疲れと安全保障不安が同時に存在する可能性がある。',
      confidence: 0.7,
      sources: [
        { title: 'Demo source: Moldova policy digest', url: 'https://example.com/moldova-europe-energy', language: 'en' },
        { title: 'Demo source: Energie și integrare europeană (ルーマニア語)', url: 'https://example.com/moldova-romanian-energy', language: 'ro' },
      ],
    },
    {
      country_code: 'MD',
      topic_rank: 2,
      category: '社会・移動',
      importance_score: 78,
      headline_ja: '若年層の国外移動と人材不足が課題化',
      summary_ja: '制度改革と欧州接近の裏側で、医療・教育などの人材不足が国内課題として残っている。',
      why_it_matters_ja: '人口移動はEU周辺国の労働市場、送金、地域サービス維持を見る重要な手がかりになる。',
      local_context_ja: '国内文脈では地政学だけでなく、家族単位の移動と雇用機会の差が重視される。',
      confidence: 0.63,
      sources: [{ title: 'Demo source: Moldova migration note', url: 'https://example.com/moldova-migration-workforce', language: 'en' }],
    },
    {
      country_code: 'SR',
      topic_rank: 1,
      category: '資源・環境',
      importance_score: 73,
      headline_ja: '資源開発と森林保全のバランスが焦点化',
      summary_ja: 'スリナムでは鉱業・エネルギー開発の期待と、森林保全・先住民地域への影響が同時に注目されている。',
      why_it_matters_ja: '南米の小規模市場でも、資源開発は気候外交と投資判断に直結する。',
      local_context_ja: '国際メディアより、地域・環境団体の発信で見える論点が多い可能性がある。',
      confidence: 0.64,
      sources: [
        { title: 'Demo source: Suriname environment watch', url: 'https://example.com/suriname-resource-forest', language: 'en' },
        { title: 'Demo source: Mijnbouw en bosbehoud (オランダ語)', url: 'https://example.com/suriname-dutch-mining', language: 'nl' },
      ],
    },
    {
      country_code: 'VU',
      topic_rank: 1,
      category: '災害・外交',
      importance_score: 79,
      headline_ja: '気候災害対応と太平洋外交の重要性が上昇',
      summary_ja: 'バヌアツでは災害復旧、インフラ支援、太平洋地域の気候外交が生活課題と結びついている。',
      why_it_matters_ja: '太平洋島嶼国の変化は、気候移動、国際支援、海洋安全保障の早期シグナルになる。',
      local_context_ja: '現地文脈では復旧速度とコミュニティ単位の支援が中心的な関心になる。',
      confidence: 0.68,
      sources: [
        { title: 'Demo source: Vanuatu resilience update', url: 'https://example.com/vanuatu-resilience', language: 'en' },
        { title: 'Demo source: Klaemet janis mo komuniti (ビスラマ語)', url: 'https://example.com/vanuatu-bislama-community', language: 'bi' },
      ],
    },
    {
      country_code: 'VU',
      topic_rank: 2,
      category: 'インフラ',
      importance_score: 74,
      headline_ja: '通信・港湾インフラの復旧力が焦点に',
      summary_ja: '災害時の通信断や物流停滞を避けるため、港湾・通信インフラの復旧力が注目されている。',
      why_it_matters_ja: '島嶼国のインフラ強化は、支援政策、物流、気候適応の優先順位を映す。',
      local_context_ja: '現地では大規模投資よりも、離島コミュニティが使える復旧手段が重視される。',
      confidence: 0.61,
      sources: [{ title: 'Demo source: Vanuatu infrastructure note', url: 'https://example.com/vanuatu-infrastructure', language: 'en' }],
    },
  ];

  const insertUpdate = db.prepare(`
    INSERT INTO country_updates (
      run_id, country_code, topic_rank, category, importance_score, headline_ja, summary_ja,
      why_it_matters_ja, local_context_ja, confidence, raw_json, created_at
    )
    VALUES (
      'seed-demo', @country_code, @topic_rank, @category, @importance_score, @headline_ja, @summary_ja,
      @why_it_matters_ja, @local_context_ja, @confidence, @raw_json, @created_at
    )
  `);
  const insertSource = db.prepare(`
    INSERT INTO sources (update_id, title, url, domain, language, published_at, citation_index)
    VALUES (@update_id, @title, @url, @domain, @language, NULL, @citation_index)
  `);

  const transaction = db.transaction(() => {
    samples.forEach((sample, index) => {
      const exists = db
        .prepare(`
          SELECT COUNT(*) AS count
          FROM country_updates
          WHERE run_id = 'seed-demo' AND country_code = @country_code AND topic_rank = @topic_rank
        `)
        .get({ country_code: sample.country_code, topic_rank: sample.topic_rank }) as { count: number };
      if (exists.count > 0) {
        return;
      }
      const result = insertUpdate.run({ ...sample, raw_json: JSON.stringify(sample), created_at: now });
      const updateId = Number(result.lastInsertRowid);
      sample.sources.forEach((source, citationIndex) => {
        insertSource.run({
          update_id: updateId,
          title: source.title,
          url: source.url,
          domain: new URL(source.url).hostname,
          language: source.language,
          citation_index: citationIndex + index,
        });
      });
    });

    const insertRunCountry = db.prepare(`
      INSERT OR IGNORE INTO research_run_countries (run_id, country_code, status, started_at, finished_at, error)
      VALUES ('seed-demo', @country_code, 'completed', @now, @now, NULL)
    `);
    for (const country of COUNTRIES) {
      insertRunCountry.run({ country_code: country.code, now });
    }

    const demoThemes = [
      {
        title_ja: '通貨・物価の圧力が生活を直撃',
        description_ja: 'ナイジェリアの通貨安とモルドバのエネルギー価格が、いずれも家計負担と政治的安定の論点につながっている。',
        country_codes: ['NG', 'MD'],
        category: '経済',
      },
      {
        title_ja: '気候リスクへの適応が小国の最優先課題に',
        description_ja: 'ブータンの山岳インフラとバヌアツの災害復旧は、気候適応の先行事例として共通の示唆を持つ。',
        country_codes: ['BT', 'VU'],
        category: '災害・気候',
      },
      {
        title_ja: '資源開発と環境保全の綱引き',
        description_ja: 'スリナムの鉱業開発とバヌアツのインフラ投資は、開発と保全のバランスという同じ問いに直面している。',
        country_codes: ['SR', 'VU'],
        category: '資源・環境',
      },
    ];
    db.prepare(`
      INSERT OR IGNORE INTO run_synthesis (run_id, digest_ja, themes_json, created_at)
      VALUES ('seed-demo', @digest_ja, @themes_json, @now)
    `).run({
      digest_ja:
        '今日の世界では、通貨と物価の圧力が複数の地域で生活課題として表面化している。ナイジェリアでは通貨安が食品価格に波及し、モルドバでは欧州接近とエネルギー調達の議論が続く。' +
        '一方、ブータンとバヌアツでは気候リスクへの適応が政策の中心にあり、スリナムでは資源開発と森林保全の緊張が高まる。' +
        '大きく報じられにくい国々の変化に、物価・気候・資源という共通の糸が通っている一日だった。',
      themes_json: JSON.stringify(demoThemes),
      now,
    });
  });

  transaction();
}

function ensureColumn(db: WorldLensDatabase, tableName: string, columnName: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}
