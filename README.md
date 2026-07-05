# World Lens PoC

World Lens は、世界各国の重要な変化を AI リサーチで収集し、国別ブリーフ・比較・出典付きで表示するデモアプリです。
「普段のニュースでは出会えない国の変化に、受動的に出会う」ことを目的に、報道の少ない国を優先表示する仕組みを持ちます。

**▶ ライブデモ: https://mossan0325.github.io/world-lens/**

実際のAIリサーチ結果のスナップショットを、ブラウザだけで操作できます(地図ズーム・国別ブリーフ・ポップアップ・横断ダイジェスト・ソース多様性など。AIリサーチの実行のみ不可)。

## できること

- 代表20か国の重要トピックを地図と一覧で確認できます。
- **発見スコア**(重要度 × 露出補正)で並び替え、報道の少ない国(rare)がブリーフ上位に必ず入るよう露出クォータを適用します。
- **3分で読む今日の世界**: 各国の結果を統合したダイジェストと、複数国にまたがる横断テーマを自動生成します。
- **今日のスポットライト**: 報道の少ない国を日替わりでローテーション表示します。
- **調査カバレッジ**: 全対象国の取得状況(データあり / 情報なし / 取得失敗 / 調査中)を一覧化します。
- **ソース多様性**: 出典の言語分布・現地語ソース比率を表示し、「現地語優先」の方針が守れているか数値で確認できます。
- 国ごとに「最後に成功したリサーチ結果」を保持し、前回との比較で各トピックに「新規 / 継続」ラベルを付けます。
- 地域タブを選ぶと世界マップがその地域へズームします。
- OpenAI APIキーを設定すると、Responses API + `web_search` で実際のWebリサーチを実行できます(structured outputs による構造化出力+自動リトライ)。
- APIキー未設定でも、内蔵デモデータで画面を確認できます。

## 初回セットアップ

```powershell
npm install
Copy-Item .env.example .env
```

実リサーチを使う場合は、`.env` に API キーを入れてください。

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-5.5
WORLD_LENS_DB_PATH=./data/world_lens.sqlite
RESEARCH_COUNTRY_LIMIT=20
RESEARCH_CONCURRENCY=3
RESEARCH_SEARCH_CONTEXT=medium
RESEARCH_AUTO_TIME=
PORT=8787
```

- `RESEARCH_CONCURRENCY`: 同時に調査する国数(1-8)。並列化により20か国の調査時間を大幅に短縮します。
- `RESEARCH_SEARCH_CONTEXT`: `low | medium | high`。コストと精度のトレードオフです。
- `RESEARCH_AUTO_TIME`: `07:00` のように設定すると、サーバー起動中は毎日その時刻に自動でリサーチが走ります(受動的な情報獲得)。

## 起動方法

```powershell
npm run dev
```

- アプリ画面: http://127.0.0.1:5173
- APIサーバー: http://127.0.0.1:8787

起動後、画面右上の「AIリサーチ開始」を押すと調査が始まります。実行中は地図のピンや一覧が国ごとに順次更新されます。
APIキーが未設定の場合、このボタンは無効化され、デモデータだけが表示されます。

### コマンドラインからの実行(定期実行向け)

```powershell
npm run research
npm run research -- --countries=JP,BT,VU --topics=経済,災害・気候
```

OSのタスクスケジューラ(Windows)や cron から呼び出せば、サーバーを起動していなくても毎日データを蓄積できます。

利用者向けの画面説明は [USER_GUIDE.md](./USER_GUIDE.md) を参照してください。
システム構成図は [SYSTEM_DIAGRAM.md](./SYSTEM_DIAGRAM.md) を参照してください。

## 基本的な使い方

1. 「3分で読む今日の世界」で全体像を把握します。
2. 地域タブで「全世界」「アジア」「欧州」などを選びます(地図がズームします)。
3. 注目トピックでカテゴリを選ぶと、表示中の一覧・地図・分布が絞り込まれます。
4. ブリーフのニュースをクリックすると、ポップアップで要約・現地文脈・出典(現地語バッジ付き)を確認できます。
5. 地図のピンをクリックするとブリーフがその国のニュース一覧に切り替わり、「← 全体ブリーフへ」で戻れます。
6. 調査カバレッジ、横断テーマの国名から選んだトピックは「選択トピック詳細」パネルに表示されます。

## 確認コマンド

```powershell
npm run build
npm run test
npm run lint
```

## 静的デモ(GitHub Pages)の更新

ライブデモは `main` への push で自動デプロイされます(GitHub Actions)。表示データは `public/demo/latest.json` のスナップショットです。
手元で新しいリサーチを実行した後、以下でデモのデータを更新できます。

```powershell
npm run export:demo     # SQLite から public/demo/latest.json を再生成
git add public/demo/latest.json
git commit -m "Update demo snapshot"
git push                # push すると Pages が自動で再デプロイ
```

ローカルで静的デモの見た目を確認する場合は `npm run build:demo` → `npm run preview:demo`(http://localhost:4173/world-lens/)。

## 補足

- 調査結果は `data/world_lens.sqlite` に保存されます。過去のリサーチ結果は消えず、国ごとに最新の成功結果が表示されます。
- `.env` と SQLite DB は `.gitignore` 対象です。
- 対象国リストは `shared/countries.ts`、国別の現地語定義は `shared/language.ts` で管理しています。
- 発見スコアの重み(anchor 1.0 / regional 1.2 / rare 1.5)は `shared/research.ts` で調整できます。
