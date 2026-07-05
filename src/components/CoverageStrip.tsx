import type { Country, RunCountryCoverage } from '../../shared/types';
import { formatRelativeTime } from '../lib/format';
import { importanceClass } from '../lib/importance';
import type { CountrySignalSummary } from '../lib/summaries';

type CoverageStripProps = {
  countries: Country[];
  summariesByCountry: Map<string, CountrySignalSummary>;
  coverageByCountry: Map<string, RunCountryCoverage>;
  onSelect: (id: number) => void;
};

// 「情報がない・取れなかった」ことも網羅性の情報として全対象国の状態を一覧化する。
export function CoverageStrip({ countries, summariesByCountry, coverageByCountry, onSelect }: CoverageStripProps) {
  return (
    <section className="coverage-panel">
      <div className="panel-heading">
        <div>
          <h2>調査カバレッジ</h2>
          <p>対象国すべての取得状況（灰色 = 変化なし・条件外、赤枠 = 取得失敗）</p>
        </div>
        <span className="subtle-chip">{countries.length}か国</span>
      </div>
      <div className="coverage-grid">
        {countries.map((country) => {
          const summary = summariesByCountry.get(country.code);
          const coverage = coverageByCountry.get(country.code);
          const stateClass = summary
            ? importanceClass(summary.maxImportance)
            : coverage?.status === 'failed'
              ? 'failed'
              : coverage?.status === 'running'
                ? 'searching'
                : coverage?.status === 'queued'
                  ? 'queued'
                  : 'none';
          const freshness = summary ? formatRelativeTime(summary.latestCreatedAt) : null;
          const statusText = summary
            ? `${summary.topicCount}件${freshness ? ` ・ ${freshness}` : ''}`
            : coverage?.status === 'failed'
              ? '取得失敗'
              : coverage?.status === 'running'
                ? '調査中…'
                : coverage?.status === 'queued'
                  ? '待機中'
                  : '情報なし';

          return (
            <button
              key={country.code}
              type="button"
              className={`coverage-chip ${stateClass}`}
              disabled={!summary}
              title={coverage?.error ? `${country.name_ja}: ${coverage.error}` : `${country.name_ja}: ${statusText}`}
              onClick={() => summary && onSelect(summary.topUpdate.id)}
            >
              <i />
              <strong>{country.name_ja}</strong>
              <small>{statusText}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
