export type RarityTier = 'anchor' | 'regional' | 'rare';

export type Country = {
  code: string;
  name_ja: string;
  name_en: string;
  region: string;
  lat: number;
  lng: number;
  rarity_tier: RarityTier;
};

export type Source = {
  id?: number;
  update_id?: number;
  title: string;
  url: string;
  domain: string;
  language?: string | null;
  published_at?: string | null;
  citation_index?: number | null;
};

export type ChangeStatus = 'new' | 'continuing';

export type CountryUpdate = {
  id: number;
  run_id: string;
  country_code: string;
  topic_rank: number;
  country_name_ja: string;
  country_name_en: string;
  region: string;
  lat: number;
  lng: number;
  rarity_tier: RarityTier;
  category: string;
  importance_score: number;
  headline_ja: string;
  summary_ja: string;
  why_it_matters_ja: string;
  local_context_ja: string;
  confidence: number;
  created_at: string;
  change_status: ChangeStatus | null;
  sources: Source[];
};

export type ResearchRun = {
  id: string;
  status: string;
  model: string;
  topics: string[];
  country_count: number;
  started_at: string;
  finished_at?: string | null;
  error?: string | null;
};

export type RunStatus = ResearchRun & {
  completed_country_count: number;
  topic_count: number;
  failed_count: number;
  current_countries: string[];
  progress: number;
};

export type SynthesisTheme = {
  title_ja: string;
  description_ja: string;
  country_codes: string[];
  category: string | null;
};

export type RunSynthesis = {
  run_id: string;
  digest_ja: string;
  themes: SynthesisTheme[];
  created_at: string;
};

export type RunCountryCoverage = {
  country_code: string;
  status: string;
  error: string | null;
  finished_at: string | null;
};

export type LatestResponse = {
  apiKeyConfigured: boolean;
  researchRunning: boolean;
  autoResearchTime: string | null;
  countries: Country[];
  run: ResearchRun | null;
  updates: CountryUpdate[];
  synthesis: RunSynthesis | null;
  coverage: RunCountryCoverage[];
};

export type ResearchRunRequest = {
  countryCodes?: string[];
  topics?: string[];
};

export type ApiError = {
  error: string;
};
