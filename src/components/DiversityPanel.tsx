import { isLocalLanguage, languageLabel, normalizeLanguage } from '../../shared/language';
import type { CountryUpdate } from '../../shared/types';

type DiversityPanelProps = {
  updates: CountryUpdate[];
};

// 「現地語優先」の方針が実際に守れているかを可視化する。偏りの是正を主張ではなく数値で示す。
export function DiversityPanel({ updates }: DiversityPanelProps) {
  let totalSources = 0;
  let withLanguage = 0;
  let localCount = 0;
  const languageCounts = new Map<string, number>();
  const domains = new Set<string>();

  for (const update of updates) {
    for (const source of update.sources) {
      totalSources += 1;
      if (source.domain) {
        domains.add(source.domain);
      }
      const code = normalizeLanguage(source.language);
      if (!code) {
        continue;
      }
      withLanguage += 1;
      languageCounts.set(code, (languageCounts.get(code) ?? 0) + 1);
      if (isLocalLanguage(update.country_code, source.language)) {
        localCount += 1;
      }
    }
  }

  const topLanguages = Array.from(languageCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxCount = topLanguages[0]?.[1] ?? 1;
  const localRatio = withLanguage > 0 ? localCount / withLanguage : null;

  return (
    <section className="diversity-panel">
      <div className="panel-heading">
        <div>
          <h2>ソース多様性</h2>
          <p>表示中トピックの出典の言語・ドメイン分布</p>
        </div>
        <span className="subtle-chip">{totalSources}ソース / {domains.size}ドメイン</span>
      </div>
      {totalSources === 0 ? (
        <p className="empty-detail">出典データがまだありません。</p>
      ) : (
        <>
          <dl className="diversity-summary">
            <div>
              <dt>現地語ソース比率</dt>
              <dd>{localRatio !== null ? `${Math.round(localRatio * 100)}%` : '言語情報なし'}</dd>
            </div>
            <div>
              <dt>言語数</dt>
              <dd>{languageCounts.size}言語</dd>
            </div>
          </dl>
          <div className="lang-bars">
            {topLanguages.map(([code, count]) => (
              <div key={code} className="lang-bar">
                <span className="lang-name">{languageLabel(code)}</span>
                <div className="lang-track">
                  <span style={{ width: `${Math.round((count / maxCount) * 100)}%` }} />
                </div>
                <span className="lang-count">{count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
