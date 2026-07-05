import type { LatestResponse, RunStatus } from '../../shared/types';
import { formatRelativeTime } from '../lib/format';
import { STATIC_DEMO } from '../lib/staticMode';

type ResearchStatusPanelProps = {
  runStatus: RunStatus | null;
  latest: LatestResponse | null;
};

const STATUS_LABELS: Record<string, string> = {
  running: '実行中',
  queued: '待機中',
  completed: '完了',
  completed_with_errors: '完了（一部失敗）',
  failed: '失敗',
};

export function ResearchStatusPanel({ runStatus, latest }: ResearchStatusPanelProps) {
  const run = latest?.run ?? null;
  const coverage = latest?.coverage ?? [];
  const countryNames = new Map((latest?.countries ?? []).map((country) => [country.code, country.name_ja]));

  const isRunning = Boolean(runStatus && ['running', 'queued'].includes(runStatus.status)) || Boolean(latest?.researchRunning);
  const completedFromCoverage = coverage.filter((entry) => entry.status === 'completed').length;
  const failedFromCoverage = coverage.filter((entry) => entry.status === 'failed').length;
  const finishedFromCoverage = completedFromCoverage + failedFromCoverage;

  const progress = runStatus?.progress ?? (coverage.length > 0 ? finishedFromCoverage / coverage.length : 0);
  const statusKey = runStatus?.status ?? run?.status ?? null;
  const statusLabel = statusKey ? (STATUS_LABELS[statusKey] ?? statusKey) : 'データなし';
  const isDemo = run?.model === 'demo-seed';
  const lastUpdated = formatRelativeTime(run?.finished_at ?? run?.started_at);
  const failedNames = coverage
    .filter((entry) => entry.status === 'failed')
    .map((entry) => countryNames.get(entry.country_code) ?? entry.country_code);
  const currentCountries = runStatus?.current_countries ?? [];

  return (
    <section className="research-panel">
      <div className="panel-heading">
        <div>
          <h2>AIリサーチ実行状況</h2>
          <p>Responses API + web_search（並列実行）</p>
        </div>
        <span className={`running-chip ${isRunning ? 'live' : ''}`}>{isDemo ? 'デモデータ' : statusLabel}</span>
      </div>

      {isRunning ? (
        <>
          <div className="progress-track"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          <dl className="status-grid">
            <div><dt>進捗</dt><dd>{Math.round(progress * 100)}%</dd></div>
            <div><dt>完了国</dt><dd>{runStatus?.completed_country_count ?? completedFromCoverage} / {runStatus?.country_count ?? coverage.length}か国</dd></div>
            <div><dt>検出トピック</dt><dd>{runStatus?.topic_count ?? 0}件</dd></div>
            <div><dt>失敗</dt><dd>{runStatus?.failed_count ?? failedFromCoverage}か国</dd></div>
            <div className="wide"><dt>調査中</dt><dd>{currentCountries.length > 0 ? currentCountries.join(' / ') : '—'}</dd></div>
          </dl>
        </>
      ) : (
        <dl className="status-grid">
          <div><dt>最終更新</dt><dd>{lastUpdated ?? 'データなし'}</dd></div>
          <div><dt>モデル</dt><dd>{run?.model ?? '—'}</dd></div>
          <div><dt>対象国</dt><dd>{run ? `${run.country_count}か国` : '—'}</dd></div>
          <div><dt>成功 / 失敗</dt><dd>{coverage.length > 0 ? `${completedFromCoverage} / ${failedFromCoverage}か国` : '—'}</dd></div>
          <div><dt>表示中トピック</dt><dd>{latest?.updates.length ?? 0}件</dd></div>
          <div><dt>自動更新</dt><dd>{latest?.autoResearchTime ? `毎日 ${latest.autoResearchTime}` : '未設定'}</dd></div>
        </dl>
      )}

      {!isRunning && failedNames.length > 0 && (
        <p className="status-note error">取得失敗: {failedNames.join('、')}（過去の成功データがあれば表示を継続しています）</p>
      )}
      {!isRunning && run?.error && failedNames.length === 0 && (
        <p className="status-note error">{run.error.slice(0, 160)}</p>
      )}
      {STATIC_DEMO ? (
        <p className="status-note">静的デモ版のため、リサーチ実行と自動更新は無効です。フル機能はREADMEの手順でローカル実行できます。</p>
      ) : !isRunning && !latest?.autoResearchTime && (
        <p className="status-note">.env の RESEARCH_AUTO_TIME（例: 07:00）を設定すると毎日自動でリサーチします。</p>
      )}
    </section>
  );
}
