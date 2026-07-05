import { ArrowLeft } from 'lucide-react';
import { RARITY_LABELS } from '../../shared/research';
import type { CountryUpdate } from '../../shared/types';
import { formatRelativeTime } from '../lib/format';
import { importanceClass, importanceLabel } from '../lib/importance';

const BRIEF_ROW_LIMIT = 8;

type BriefPanelProps = {
  updates: CountryUpdate[];
  totalCount: number;
  activeUpdateId: number | null;
  onOpen: (id: number) => void;
  // 地図で国を選択すると、その国のニュース一覧モードに切り替わる。
  focusCountryName: string | null;
  onClearFocus: () => void;
};

export function BriefPanel({ updates, totalCount, activeUpdateId, onOpen, focusCountryName, onClearFocus }: BriefPanelProps) {
  const isFocused = focusCountryName !== null;

  return (
    <section className={`brief-panel ${isFocused ? 'focused' : ''}`} id="brief">
      <div className="panel-heading">
        <div>
          <h2>{isFocused ? `${focusCountryName}のニュース` : '今日のインテリジェンス・ブリーフ'}</h2>
          <p>{isFocused ? '地図で選択した国のトピック（クリックで詳細）' : '並び順 = 重要度 × 露出補正（クリックで詳細を表示）'}</p>
        </div>
        <div className="heading-actions">
          {isFocused && (
            <button type="button" className="brief-back" onClick={onClearFocus}>
              <ArrowLeft size={14} />
              全体ブリーフへ
            </button>
          )}
          <span className="subtle-chip">全{totalCount}件</span>
        </div>
      </div>
      <div className="brief-list">
        {updates.slice(0, BRIEF_ROW_LIMIT).map((update, index) => (
          <button
            key={update.id}
            type="button"
            className={`brief-row ${activeUpdateId === update.id ? 'active' : ''}`}
            onClick={() => onOpen(update.id)}
            aria-haspopup="dialog"
            title={update.rarity_tier === 'rare' ? 'メディア露出が少ない国のため、発見スコアを加点して表示しています' : undefined}
          >
            <span className="rank">{index + 1}</span>
            <span>
              <strong>
                {isFocused ? `#${update.topic_rank} ${update.category}` : update.country_name_ja}
                {update.rarity_tier === 'rare' && <span className="badge-rare">{RARITY_LABELS.rare}</span>}
                {update.change_status === 'new' && <span className="badge-new">新規</span>}
                {update.change_status === 'continuing' && <span className="badge-continuing">継続</span>}
              </strong>
              <em>{update.headline_ja}</em>
              <small>
                {isFocused ? update.country_name_ja : update.category} ・ 国内順位 {update.topic_rank}
                {formatRelativeTime(update.created_at) ? ` ・ ${formatRelativeTime(update.created_at)}` : ''}
              </small>
            </span>
            <b className={importanceClass(update.importance_score)}>{importanceLabel(update.importance_score)}</b>
          </button>
        ))}
        {updates.length === 0 && (
          <p className="empty-detail">
            {isFocused
              ? `この条件に合う${focusCountryName}のトピックはありません。「全体ブリーフへ」で戻るか、注目トピックを変えてみてください。`
              : 'この条件に合うトピックはありません。地域・トピックの選択を変えてみてください。'}
          </p>
        )}
      </div>
    </section>
  );
}
