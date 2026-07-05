import { Compass, Newspaper, Sparkles } from 'lucide-react';
import { RARITY_LABELS } from '../../shared/research';
import type { Country, CountryUpdate, RunSynthesis } from '../../shared/types';
import { formatRelativeTime } from '../lib/format';

type SynthesisBandProps = {
  synthesis: RunSynthesis | null;
  spotlight: CountryUpdate | null;
  countriesByCode: Map<string, Country>;
  onSelectUpdate: (id: number) => void;
  onSelectCountry: (code: string) => void;
};

export function SynthesisBand({ synthesis, spotlight, countriesByCode, onSelectUpdate, onSelectCountry }: SynthesisBandProps) {
  return (
    <section className="synthesis-band" id="digest" aria-label="Daily digest and cross-country themes">
      <div className="digest-block">
        <div className="panel-heading">
          <div>
            <h2><Newspaper size={15} /> 3分で読む今日の世界</h2>
            <p>{synthesis ? `AIによる横断ダイジェスト ・ ${formatRelativeTime(synthesis.created_at) ?? ''}` : 'AIによる横断ダイジェスト'}</p>
          </div>
        </div>
        {synthesis ? (
          <>
            <p className="digest-text">{synthesis.digest_ja}</p>
            {synthesis.themes.length > 0 && (
              <div className="theme-list" aria-label="Cross-country themes">
                {synthesis.themes.map((theme) => (
                  <div key={theme.title_ja} className="theme-chip">
                    <strong><Sparkles size={13} /> {theme.title_ja}</strong>
                    {theme.description_ja && <small>{theme.description_ja}</small>}
                    <span className="theme-countries">
                      {theme.country_codes.map((code) => {
                        const country = countriesByCode.get(code);
                        if (!country) {
                          return null;
                        }
                        return (
                          <button key={code} type="button" onClick={() => onSelectCountry(code)}>
                            {country.name_ja}
                          </button>
                        );
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="digest-text empty">AIリサーチを実行すると、各国の結果を統合した「今日の世界ダイジェスト」と横断テーマがここに表示されます。</p>
        )}
      </div>
      {spotlight && (
        <aside className="spotlight-card" aria-label="Today's spotlight country">
          <p className="spotlight-label"><Compass size={14} /> 今日のスポットライト</p>
          <span className="badge-rare">{RARITY_LABELS[spotlight.rarity_tier]}</span>
          <h3>{spotlight.country_name_ja}</h3>
          <p className="spotlight-headline">{spotlight.headline_ja}</p>
          <button type="button" onClick={() => onSelectUpdate(spotlight.id)}>この国を見る</button>
        </aside>
      )}
    </section>
  );
}
