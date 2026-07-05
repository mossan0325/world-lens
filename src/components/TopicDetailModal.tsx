import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { CountryUpdate } from '../../shared/types';
import { TopicDetailContent } from './TopicDetailContent';

type TopicDetailModalProps = {
  update: CountryUpdate;
  onClose: () => void;
};

// ブリーフのニュースをクリックしたときに内容を表示するポップアップ。
// Escキー・✕ボタン・背景クリックのいずれでも閉じられる。
export function TopicDetailModal({ update, onClose }: TopicDetailModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={`${update.country_name_ja}: ${update.headline_ja}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <p className="modal-country">
            {update.country_name_ja}
            <small>国内順位 #{update.topic_rank} ・ {update.region}</small>
          </p>
          <button ref={closeButtonRef} type="button" className="modal-close" aria-label="閉じる" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <TopicDetailContent update={update} />
      </div>
    </div>
  );
}
