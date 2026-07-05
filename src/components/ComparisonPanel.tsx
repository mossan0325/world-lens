import { RARITY_LABELS } from '../../shared/research';
import { formatRelativeTime } from '../lib/format';
import type { CountrySignalSummary } from '../lib/summaries';

type ComparisonPanelProps = {
  summaries: CountrySignalSummary[];
  localRatioByCountry: Map<string, number | null>;
};

export function ComparisonPanel({ summaries, localRatioByCountry }: ComparisonPanelProps) {
  return (
    <section className="comparison-panel">
      <div className="panel-heading">
        <div>
          <h2>国別比較</h2>
          <p>選択地域の上位シグナル（発見スコア順）</p>
        </div>
      </div>
      <div className="comparison-cards">
        {summaries.map((summary) => {
          const localRatio = localRatioByCountry.get(summary.country_code) ?? null;
          return (
            <article key={summary.country_code} className="compare-card">
              <span className="country-code">{summary.country_code}</span>
              {summary.rarity_tier === 'rare' && <span className="badge-rare">{RARITY_LABELS.rare}</span>}
              <h3>{summary.country_name_ja}</h3>
              <p>{summary.topicCount}トピック ・ {summary.categories.join(' / ')}</p>
              <div className="signal-line">
                <span style={{ width: `${summary.maxImportance}%` }} />
              </div>
              <small>
                最高重要度 {summary.maxImportance} ・ 平均信頼度 {Math.round(summary.avgConfidence * 100)}%
                {localRatio !== null ? ` ・ 現地語ソース ${Math.round(localRatio * 100)}%` : ''}
              </small>
              <small className="freshness">{formatRelativeTime(summary.latestCreatedAt) ?? ''}</small>
            </article>
          );
        })}
        {summaries.length === 0 && <p className="empty-detail">比較対象のデータがありません。</p>}
      </div>
    </section>
  );
}
