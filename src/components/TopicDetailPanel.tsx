import type { CountryUpdate } from '../../shared/types';
import { TopicDetailContent } from './TopicDetailContent';

type TopicDetailPanelProps = {
  update?: CountryUpdate;
};

export function TopicDetailPanel({ update }: TopicDetailPanelProps) {
  return (
    <section className="source-panel" id="sources">
      <div className="panel-heading">
        <div>
          <h2>選択トピック詳細</h2>
          <p>{update ? `${update.country_name_ja} #${update.topic_rank}: ${update.headline_ja}` : 'トピックを選択'}</p>
        </div>
      </div>
      {update ? (
        <TopicDetailContent update={update} />
      ) : (
        <p className="empty-detail">トピックを選択すると要約と出典を表示します。</p>
      )}
    </section>
  );
}
