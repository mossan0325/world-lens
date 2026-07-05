import { ExternalLink } from 'lucide-react';
import { isLocalLanguage, languageLabel, localSourceRatio, normalizeLanguage } from '../../shared/language';
import { RARITY_LABELS } from '../../shared/research';
import type { CountryUpdate } from '../../shared/types';
import { formatRelativeTime } from '../lib/format';

// トピック詳細の本文(メタ・要約・現地文脈・出典)。詳細パネルとポップアップの両方から使う。
export function TopicDetailContent({ update }: { update: CountryUpdate }) {
  const localRatio = localSourceRatio(update.country_code, update.sources);

  return (
    <>
      <div className="topic-detail">
        <div className="detail-metrics">
          <span>{update.category}</span>
          <span>重要度 {update.importance_score}</span>
          <span>信頼度 {Math.round(update.confidence * 100)}%</span>
          {update.rarity_tier === 'rare' && <span className="badge-rare">{RARITY_LABELS.rare}</span>}
          {update.change_status === 'new' && <span className="badge-new">前回から新規</span>}
          {update.change_status === 'continuing' && <span className="badge-continuing">前回から継続</span>}
          {formatRelativeTime(update.created_at) && <span>取得 {formatRelativeTime(update.created_at)}</span>}
          {localRatio !== null && <span>現地語ソース {Math.round(localRatio * 100)}%</span>}
        </div>
        <h3>{update.headline_ja}</h3>
        <section className="detail-block">
          <h4>要約</h4>
          <p>{update.summary_ja}</p>
        </section>
        <section className="detail-block">
          <h4>なぜ重要か</h4>
          <p>{update.why_it_matters_ja}</p>
        </section>
        <section className="detail-block">
          <h4>現地文脈</h4>
          <p>{update.local_context_ja}</p>
        </section>
        <h4 className="source-heading">情報ソース（出典）</h4>
      </div>
      <div className="source-list">
        {update.sources.length > 0
          ? update.sources.map((source, index) => {
            const languageCode = normalizeLanguage(source.language);
            const isLocal = isLocalLanguage(update.country_code, source.language);
            return (
              <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer">
                <span>{index + 1}</span>
                <strong>{source.title}</strong>
                <small>
                  {source.domain}
                  {languageCode ? ` ・${languageLabel(languageCode)}` : ''}
                </small>
                {isLocal && <span className="badge-local">現地語</span>}
                <ExternalLink size={15} />
              </a>
            );
          })
          : <p className="source-empty">出典は取得できませんでした。</p>}
      </div>
    </>
  );
}
