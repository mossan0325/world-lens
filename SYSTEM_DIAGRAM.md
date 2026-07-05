# World Lens システム図

```mermaid
flowchart LR
  user["利用ユーザー"] --> browser["ブラウザ<br/>React + Vite UI"]

  subgraph ui["フロントエンド"]
    browser --> digest["3分で読む今日の世界<br/>横断テーマ / スポットライト"]
    browser --> controls["地域 / トピック選択<br/>(表示フィルタ + 調査テーマ)"]
    browser --> map["世界マップ<br/>地域ズーム / 状態別ピン"]
    browser --> brief["インテリジェンス・ブリーフ<br/>発見スコア順 + 露出クォータ"]
    browser --> coverage["調査カバレッジ<br/>全対象国の取得状況"]
    browser --> diversity["ソース多様性<br/>言語分布 / 現地語比率"]
    browser --> detail["選択トピック詳細<br/>要約 / 現地文脈 / 出典"]
    browser --> meter["今週の探索メーター<br/>(localStorage)"]
  end

  browser --> api["Express API<br/>http://127.0.0.1:8787"]

  subgraph endpoints["APIエンドポイント"]
    api --> countries["GET /api/countries"]
    api --> latest["GET /api/research/latest<br/>(国別最新 + synthesis + coverage)"]
    api --> run["POST /api/research/run<br/>(実行中は409)"]
    api --> status["GET /api/research/runs/:id"]
  end

  subgraph backend["バックエンド処理"]
    run --> job["researchJob<br/>並列実行(既定3) + リトライ"]
    scheduler["scheduler<br/>RESEARCH_AUTO_TIME で毎日自動実行"] --> job
    cli["researchCli<br/>npm run research (OSスケジューラ向け)"] --> job
    status --> job
    job --> research["Responses API<br/>web_search + structured outputs<br/>重要度ルーブリック"]
    research --> parser["JSON抽出 / 正規化"]
    job --> synthesis["synthesis<br/>横断テーマ + ダイジェスト生成(1回)"]
  end

  subgraph storage["SQLite DB"]
    db[("data/world_lens.sqlite")]
    countries --> db
    latest --> db
    status --> db
    parser --> db
    synthesis --> db
    db --> tables["countries<br/>research_runs<br/>research_run_countries<br/>country_updates<br/>sources<br/>run_synthesis"]
  end

  env[".env<br/>OPENAI_API_KEY / OPENAI_MODEL<br/>RESEARCH_CONCURRENCY<br/>RESEARCH_AUTO_TIME<br/>RESEARCH_SEARCH_CONTEXT"] --> api
  research --> web["Web検索結果 / 出典URL"]
```

## データの流れ

1. ユーザーが地域・トピックを選び、AIリサーチを開始します(または `RESEARCH_AUTO_TIME` / `npm run research` による自動実行)。
2. Express が国別リサーチジョブを並列(既定3並列)で開始します。多重実行は 409 で防止します。
3. 各国について Responses API + `web_search` が主要トピック、要約、重要理由、現地文脈、出典を生成します。structured outputs で形式を保証し、失敗時は従来方式で1回リトライします。
4. 全国の完了後、結果を1回のLLM呼び出しで統合し、「今日の世界ダイジェスト」と複数国にまたがる横断テーマを生成します(`run_synthesis`)。
5. UI は実行中も `GET /api/research/latest` をポーリングし、完了した国から地図・ブリーフへ順次反映します。
6. 表示は「国ごとの最後に成功した結果」を使うため、あるランで取得に失敗した国も過去データが残ります。前回ランとの比較で「新規 / 継続」を判定します。

## 偏り是正の仕組み

- **発見スコア** = importance_score × 露出補正(anchor 1.0 / regional 1.2 / rare 1.5)。並び順に適用。
- **露出クォータ**: ブリーフ上位8件に rare 国を最低2件確保(データがある場合)。
- **重要度ルーブリック**: 「国の大きさではなく変化の大きさ」を全国共通の基準で採点するようプロンプトで統一。
- **ソース多様性の計測**: 出典の言語を正規化し、国別の現地語定義(`shared/language.ts`)と照合して現地語比率を算出・表示。
