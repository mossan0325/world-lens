import type { CountryUpdate } from '../../shared/types';
import { importanceClass } from '../lib/importance';

type SignalTimelineProps = {
  updates: CountryUpdate[];
  activeUpdateId: number | null;
  onSelect: (id: number) => void;
};

// 横軸 = 重要度スコア(1-100)。点の位置が実データを表す。
export function SignalTimeline({ updates, activeUpdateId, onSelect }: SignalTimelineProps) {
  const regions = Array.from(new Set(updates.map((update) => update.region))).slice(0, 6);
  return (
    <section className="timeline-panel">
      <div className="panel-heading">
        <div>
          <h2>シグナル分布</h2>
          <p>地域別の重要度分布（横軸 = 重要度スコア）</p>
        </div>
      </div>
      <div className="timeline-scale" aria-hidden="true">
        <span className="scale-origin">0</span>
        <span className="scale-mid" style={{ left: '70%' }}>70</span>
        <span className="scale-high" style={{ left: '85%' }}>85</span>
        <span className="scale-max">100</span>
      </div>
      <div className="timeline">
        {regions.map((region) => (
          <div className="timeline-row" key={region}>
            <span>{region}</span>
            <div>
              <i className="threshold-guide" style={{ left: '70%' }} />
              <i className="threshold-guide high" style={{ left: '85%' }} />
              {updates
                .filter((update) => update.region === region)
                .map((update) => (
                  <button
                    key={update.id}
                    className={`${importanceClass(update.importance_score)} ${activeUpdateId === update.id ? 'active' : ''}`}
                    style={{ left: `${Math.min(98, Math.max(2, update.importance_score))}%` }}
                    title={`${update.country_name_ja}: ${update.headline_ja}（重要度${update.importance_score}）`}
                    type="button"
                    aria-label={`${update.country_name_ja}: ${update.headline_ja}`}
                    aria-pressed={activeUpdateId === update.id}
                    onClick={() => onSelect(update.id)}
                  />
                ))}
            </div>
          </div>
        ))}
        {regions.length === 0 && <p className="empty-detail">表示できるシグナルがありません。</p>}
      </div>
    </section>
  );
}
