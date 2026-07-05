import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Database,
  Globe2,
  Layers3,
  Newspaper,
  Play,
  Search,
} from 'lucide-react';
import './App.css';
import { REGIONS } from '../shared/countries';
import { localSourceRatio } from '../shared/language';
import { CATEGORIES, DEFAULT_RESEARCH_TOPICS, matchesCategory } from '../shared/research';
import type { Country, LatestResponse, RunStatus } from '../shared/types';
import { BriefPanel } from './components/BriefPanel';
import { ComparisonPanel } from './components/ComparisonPanel';
import { CoverageStrip } from './components/CoverageStrip';
import { DiversityPanel } from './components/DiversityPanel';
import { ResearchStatusPanel } from './components/ResearchStatusPanel';
import { SignalTimeline } from './components/SignalTimeline';
import { SynthesisBand } from './components/SynthesisBand';
import { TopicDetailModal } from './components/TopicDetailModal';
import { TopicDetailPanel } from './components/TopicDetailPanel';
import { WorldMap } from './components/WorldMap';
import { applyRareQuota, pickSpotlight, sortByDiscovery } from './lib/discovery';
import { formatJapaneseDate, formatRelativeTime, isFresh } from './lib/format';
import { buildCountrySummaries } from './lib/summaries';
import { loadViewedCountries, recordViewedCountry, viewedWithinDays } from './lib/viewedCountries';

const TOPICS = ['総合', ...CATEGORIES];
const BRIEF_VISIBLE_SLOTS = 8;
const BRIEF_MIN_RARE = 2;

function App() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [latest, setLatest] = useState<LatestResponse | null>(null);
  const [selectedRegion, setSelectedRegion] = useState('全世界');
  const [selectedTopic, setSelectedTopic] = useState(TOPICS[0]);
  const [activeUpdateId, setActiveUpdateId] = useState<number | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewed, setViewed] = useState(() => loadViewedCountries());
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  // 地図で国を選ぶと、ブリーフがその国のニュース一覧に切り替わる(nullなら全体ブリーフ)。
  const [focusCountryCode, setFocusCountryCode] = useState<string | null>(null);

  const refreshLatest = useCallback(async () => {
    const [countriesResponse, latestResponse] = await Promise.all([
      fetch('/api/countries'),
      fetch('/api/research/latest'),
    ]);
    if (!countriesResponse.ok || !latestResponse.ok) {
      throw new Error('データを読み込めませんでした。');
    }
    const [countriesData, latestData] = await Promise.all([
      countriesResponse.json() as Promise<Country[]>,
      latestResponse.json() as Promise<LatestResponse>,
    ]);
    setCountries(countriesData);
    setLatest(latestData);
    setActiveUpdateId((current) => current ?? latestData.updates[0]?.id ?? null);
  }, []);

  // dev環境ではAPIサーバーの起動がクライアントより遅れることがあるため、初回ロードは数回リトライする。
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          await refreshLatest();
          return;
        } catch (refreshError) {
          if (cancelled) {
            return;
          }
          if (attempt === 4) {
            setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 900));
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshLatest]);

  // このセッションで開始したランの進捗を追いつつ、/latest も更新して地図・一覧へ逐次反映する。
  useEffect(() => {
    if (!runId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshLatest().catch(() => {
        // 進捗ポーリング中の一時的な失敗は無視して次のタイマーで再試行する。
      });
      fetch(`/api/research/runs/${runId}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error('リサーチ進捗を取得できませんでした。');
          }
          return response.json() as Promise<RunStatus>;
        })
        .then((status) => {
          setRunStatus(status);
          if (!['running', 'queued'].includes(status.status)) {
            window.clearInterval(intervalId);
            setRunId(null);
            refreshLatest().catch((refreshError: unknown) => {
              setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
            });
          }
        })
        .catch((pollError: unknown) => {
          setError(pollError instanceof Error ? pollError.message : String(pollError));
          window.clearInterval(intervalId);
        });
    }, 1600);

    return () => window.clearInterval(intervalId);
  }, [refreshLatest, runId]);

  // スケジュール実行やCLIなど、他プロセスが開始したランも検知して追従する。
  const remoteRunning = Boolean(latest?.researchRunning) && !runId;
  useEffect(() => {
    if (!remoteRunning) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void refreshLatest().catch(() => {
        // 次のタイマーで再試行する。
      });
    }, 2500);
    return () => window.clearInterval(intervalId);
  }, [refreshLatest, remoteRunning]);

  const updates = useMemo(() => latest?.updates ?? [], [latest?.updates]);
  const countriesByCode = useMemo(() => new Map(countries.map((country) => [country.code, country])), [countries]);
  const visibleCountries = useMemo(
    () => countries.filter((country) => selectedRegion === '全世界' || country.region === selectedRegion),
    [countries, selectedRegion],
  );
  const visibleUpdates = useMemo(
    () =>
      updates.filter(
        (update) =>
          (selectedRegion === '全世界' || update.region === selectedRegion) &&
          matchesCategory(update.category, selectedTopic),
      ),
    [selectedRegion, selectedTopic, updates],
  );
  const briefUpdates = useMemo(
    () => applyRareQuota(sortByDiscovery(visibleUpdates), BRIEF_VISIBLE_SLOTS, BRIEF_MIN_RARE),
    [visibleUpdates],
  );
  // 国フォーカス時はその国のトピックを国内順位で表示する。
  const focusUpdates = useMemo(
    () =>
      focusCountryCode
        ? visibleUpdates
            .filter((update) => update.country_code === focusCountryCode)
            .toSorted((a, b) => a.topic_rank - b.topic_rank)
        : null,
    [focusCountryCode, visibleUpdates],
  );
  const activeUpdate = useMemo(
    () => visibleUpdates.find((update) => update.id === activeUpdateId) ?? briefUpdates[0],
    [activeUpdateId, briefUpdates, visibleUpdates],
  );
  const countrySummaries = useMemo(() => buildCountrySummaries(visibleUpdates), [visibleUpdates]);
  const summariesByCountry = useMemo(
    () => new Map(countrySummaries.map((summary) => [summary.country_code, summary])),
    [countrySummaries],
  );
  const coverageByCountry = useMemo(
    () => new Map((latest?.coverage ?? []).map((entry) => [entry.country_code, entry])),
    [latest?.coverage],
  );
  const localRatioByCountry = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const summary of countrySummaries) {
      const sources = visibleUpdates
        .filter((update) => update.country_code === summary.country_code)
        .flatMap((update) => update.sources);
      map.set(summary.country_code, localSourceRatio(summary.country_code, sources));
    }
    return map;
  }, [countrySummaries, visibleUpdates]);
  const spotlight = useMemo(() => pickSpotlight(updates, new Date()), [updates]);
  const comparisonSummaries = countrySummaries.slice(0, 3);
  const isRunning = Boolean(runStatus && ['running', 'queued'].includes(runStatus.status)) || Boolean(latest?.researchRunning);
  const apiKeyConfigured = latest?.apiKeyConfigured ?? false;

  useEffect(() => {
    if (visibleUpdates.length === 0) {
      return;
    }
    if (!visibleUpdates.some((update) => update.id === activeUpdateId)) {
      setActiveUpdateId(visibleUpdates[0].id);
    }
  }, [activeUpdateId, visibleUpdates]);

  // 閲覧した国を記録し、「今週の探索」メーターに反映する。
  const activeCountryCode = activeUpdate?.country_code ?? null;
  useEffect(() => {
    if (!activeCountryCode) {
      return;
    }
    setViewed((current) => recordViewedCountry(current, activeCountryCode));
  }, [activeCountryCode]);

  const weeklyViewed = useMemo(() => new Set(viewedWithinDays(viewed, 7)), [viewed]);
  const weeklyViewedCount = countries.filter((country) => weeklyViewed.has(country.code)).length;
  const rareCountries = countries.filter((country) => country.rarity_tier === 'rare');
  const rareViewedCount = rareCountries.filter((country) => weeklyViewed.has(country.code)).length;

  const lastRun = latest?.run ?? null;
  const lastUpdatedIso = lastRun?.finished_at ?? lastRun?.started_at ?? null;
  const lastUpdatedRelative = formatRelativeTime(lastUpdatedIso);
  const dataFresh = isFresh(lastUpdatedIso, 24);

  async function startResearch() {
    setError(null);
    const topicPayload = selectedTopic === '総合' ? DEFAULT_RESEARCH_TOPICS : [selectedTopic];
    const countryCodes = visibleCountries.map((country) => country.code);
    const response = await fetch('/api/research/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCodes, topics: topicPayload }),
    });
    const payload = (await response.json()) as { runId?: string; error?: string };
    if (!response.ok || !payload.runId) {
      throw new Error(payload.error ?? 'リサーチを開始できませんでした。');
    }
    setRunId(payload.runId);
    setRunStatus(null);
  }

  // ブリーフのニュースはクリックでポップアップ表示する(選択状態も同期して地図等をハイライト)。
  function openBriefTopic(id: number) {
    setActiveUpdateId(id);
    setDetailModalOpen(true);
  }

  // 地図のピンをクリックすると、ブリーフがその国のニュース一覧に切り替わる。
  function focusMapCountry(code: string) {
    const summary = summariesByCountry.get(code);
    if (summary) {
      setActiveUpdateId(summary.topUpdate.id);
    }
    setFocusCountryCode(code);
  }

  function selectCountry(code: string) {
    setFocusCountryCode(null);
    const summary = summariesByCountry.get(code);
    if (summary) {
      setActiveUpdateId(summary.topUpdate.id);
      return;
    }
    // 表示フィルタ外の国が指定されたらフィルタを解除して表示する。
    const update = updates.find((item) => item.country_code === code);
    if (update) {
      setSelectedRegion('全世界');
      setSelectedTopic(TOPICS[0]);
      setActiveUpdateId(update.id);
    }
  }

  function selectSpotlight(id: number) {
    const update = updates.find((item) => item.id === id);
    if (!update) {
      return;
    }
    setFocusCountryCode(null);
    if (!visibleUpdates.some((item) => item.id === id)) {
      setSelectedRegion('全世界');
      setSelectedTopic(TOPICS[0]);
    }
    setActiveUpdateId(id);
  }

  return (
    <div className="app-shell">
      <aside className="side-rail" aria-label="World Lens navigation">
        <div className="brand">
          <span className="brand-mark"><Globe2 size={21} /></span>
          <span>World Lens</span>
        </div>
        <nav className="rail-nav">
          <a className="active" href="#dashboard"><Globe2 size={18} />ダッシュボード</a>
          <a href="#digest"><Newspaper size={18} />ダイジェスト</a>
          <a href="#map"><Search size={18} />世界マップ</a>
          <a href="#brief"><Layers3 size={18} />重要トピック</a>
          <a href="#sources"><Database size={18} />出典</a>
        </nav>
        <div className="rail-status">
          <span className={`status-dot ${dataFresh ? '' : 'stale'}`} />
          <p>データ更新</p>
          <strong>{lastUpdatedRelative ?? 'まだ実行なし'}</strong>
          <p className="rail-meter-label">今週の探索 {weeklyViewedCount}/{countries.length || '-'}か国</p>
          <div className="mini-meter">
            <span style={{ width: `${countries.length > 0 ? Math.round((weeklyViewedCount / countries.length) * 100) : 0}%` }} />
          </div>
          <small>報道の少ない国 {rareViewedCount}/{rareCountries.length}か国に接触</small>
        </div>
      </aside>

      <main className="workspace" id="dashboard">
        <header className="topbar">
          <div>
            <p className="screen-label">ダッシュボード</p>
            <h1>世界の重要な変化に、受動的に出会う。</h1>
          </div>
          <div className="top-actions">
            <span className="date-chip">{formatJapaneseDate(new Date())}</span>
            <span className={`date-chip freshness-chip ${dataFresh ? 'fresh' : 'stale'}`}>
              データ {lastUpdatedRelative ?? 'なし'}
            </span>
            <button
              className="primary-action"
              type="button"
              disabled={!apiKeyConfigured || isRunning}
              onClick={() => {
                startResearch().catch((startError: unknown) => {
                  setError(startError instanceof Error ? startError.message : String(startError));
                });
              }}
            >
              <Play size={16} />
              {isRunning ? 'AIリサーチ中' : 'AIリサーチ開始'}
              <ChevronRight size={16} />
            </button>
          </div>
        </header>

        {!apiKeyConfigured && (
          <section className="notice" aria-live="polite">
            <AlertTriangle size={18} />
            <span><code>.env</code> に <code>OPENAI_API_KEY</code> を設定してサーバーを再起動すると、実リサーチを開始できます。</span>
          </section>
        )}
        {error && <section className="notice error"><AlertTriangle size={18} />{error}</section>}

        <section className="control-strip" aria-label="Research controls">
          <div className="segmented" aria-label="Region filter">
            {REGIONS.map((region) => (
              <button
                key={region}
                type="button"
                className={selectedRegion === region ? 'selected' : ''}
                onClick={() => {
                  setSelectedRegion(region);
                  setFocusCountryCode(null);
                }}
              >
                {region}
              </button>
            ))}
          </div>
          <div className="topic-select">
            <label htmlFor="topic">注目トピック（表示の絞り込み・調査テーマ）</label>
            <select id="topic" value={selectedTopic} onChange={(event) => setSelectedTopic(event.target.value)}>
              {TOPICS.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
            </select>
          </div>
        </section>

        <SynthesisBand
          synthesis={latest?.synthesis ?? null}
          spotlight={spotlight}
          countriesByCode={countriesByCode}
          onSelectUpdate={selectSpotlight}
          onSelectCountry={selectCountry}
        />

        <section className="dashboard-grid">
          <WorldMap
            countries={visibleCountries}
            summaries={countrySummaries}
            coverageByCountry={coverageByCountry}
            region={selectedRegion}
            activeCountryCode={activeUpdate?.country_code ?? null}
            onSelectCountry={focusMapCountry}
          />
          <BriefPanel
            updates={focusUpdates ?? briefUpdates}
            totalCount={focusUpdates ? focusUpdates.length : visibleUpdates.length}
            activeUpdateId={activeUpdate?.id ?? null}
            onOpen={openBriefTopic}
            focusCountryName={focusCountryCode ? countriesByCode.get(focusCountryCode)?.name_ja ?? null : null}
            onClearFocus={() => setFocusCountryCode(null)}
          />
          <CoverageStrip
            countries={visibleCountries}
            summariesByCountry={summariesByCountry}
            coverageByCountry={coverageByCountry}
            onSelect={setActiveUpdateId}
          />
          <TopicDetailPanel update={activeUpdate} />
          <ComparisonPanel summaries={comparisonSummaries} localRatioByCountry={localRatioByCountry} />
          <DiversityPanel updates={visibleUpdates} />
          <SignalTimeline updates={visibleUpdates} activeUpdateId={activeUpdate?.id ?? null} onSelect={setActiveUpdateId} />
          <ResearchStatusPanel runStatus={runStatus} latest={latest} />
        </section>
      </main>

      {detailModalOpen && activeUpdate && (
        <TopicDetailModal update={activeUpdate} onClose={() => setDetailModalOpen(false)} />
      )}
    </div>
  );
}

export default App;
