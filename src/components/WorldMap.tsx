import { useMemo } from 'react';
import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import worldAtlas from 'world-atlas/countries-110m.json';
import type { Country, RunCountryCoverage } from '../../shared/types';
import { importanceClass } from '../lib/importance';
import { formatRelativeTime } from '../lib/format';
import type { CountrySignalSummary } from '../lib/summaries';

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 520;
const REGION_PADDING_DEGREES = 8;

type WorldTopology = Topology<{
  countries: GeometryCollection;
  land: GeometryCollection;
}>;

type MapProps = {
  countries: Country[];
  summaries: CountrySignalSummary[];
  coverageByCountry: Map<string, RunCountryCoverage>;
  region: string;
  activeCountryCode: string | null;
  onSelectCountry: (code: string) => void;
};

const topology = worldAtlas as unknown as WorldTopology;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function WorldMap({ countries, summaries, coverageByCountry, region, activeCountryCode, onSelectCountry }: MapProps) {
  const summaryByCountry = useMemo(
    () => new Map(summaries.map((summary) => [summary.country_code, summary])),
    [summaries],
  );

  const mapGeometry = useMemo(() => {
    const projection = geoNaturalEarth1();
    const extent: [[number, number], [number, number]] = [[24, 22], [MAP_WIDTH - 24, MAP_HEIGHT - 20]];

    if (region === '全世界' || countries.length === 0) {
      projection.fitExtent(extent, { type: 'Sphere' });
    } else {
      // 地域タブ選択時は、その地域の対象国を含む範囲へズームする。
      const paddedPoints = countries.flatMap((country) => [
        [clamp(country.lng - REGION_PADDING_DEGREES, -179.9, 179.9), clamp(country.lat - REGION_PADDING_DEGREES, -85, 85)],
        [clamp(country.lng + REGION_PADDING_DEGREES, -179.9, 179.9), clamp(country.lat + REGION_PADDING_DEGREES, -85, 85)],
      ]);
      projection.fitExtent(extent, { type: 'MultiPoint', coordinates: paddedPoints } as unknown as Parameters<typeof projection.fitExtent>[1]);
    }

    const path = geoPath(projection);
    const countriesFeature = feature(topology, topology.objects.countries) as FeatureCollection<Geometry>;
    const borders = mesh(topology, topology.objects.countries, (a, b) => a !== b);

    return {
      countries: countriesFeature.features.filter((country) => country.properties?.name !== 'Antarctica'),
      graticulePath: path(geoGraticule10()),
      spherePath: path({ type: 'Sphere' }),
      bordersPath: path(borders),
      path,
      project: (lat: number, lng: number) => projection([lng, lat]),
    };
  }, [countries, region]);

  const totalTopics = summaries.reduce((sum, item) => sum + item.topicCount, 0);

  return (
    <section className="map-panel" id="map">
      <div className="panel-heading">
        <div>
          <h2>世界マップ</h2>
          <p>{region === '全世界' ? '対象国のシグナルを俯瞰(地域タブでズーム)' : `${region}にズーム中`}</p>
        </div>
        <span className="subtle-chip">{countries.length}か国 / {totalTopics}件</span>
      </div>
      <div className="map-canvas">
        <svg className="world-backdrop" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="img" aria-label="World map with country signal pins">
          {mapGeometry.spherePath && <path className="map-sphere" d={mapGeometry.spherePath} />}
          {mapGeometry.graticulePath && <path className="map-graticule" d={mapGeometry.graticulePath} />}
          <g className="country-layer">
            {mapGeometry.countries.map((country, index) => {
              const pathData = mapGeometry.path(country);
              if (!pathData) {
                return null;
              }

              return <path key={`${country.properties?.name ?? 'country'}-${index}`} className="country-shape" d={pathData} />;
            })}
          </g>
          {mapGeometry.bordersPath && <path className="country-boundaries" d={mapGeometry.bordersPath} />}
        </svg>
        {countries.map((country) => {
          const summary = summaryByCountry.get(country.code);
          const coverage = coverageByCountry.get(country.code);
          const point = mapGeometry.project(country.lat, country.lng);
          const isActive = country.code === activeCountryCode;
          if (!point || point[0] < 0 || point[0] > MAP_WIDTH || point[1] < 0 || point[1] > MAP_HEIGHT) {
            return null;
          }

          const stateClass = summary
            ? importanceClass(summary.maxImportance)
            : coverage?.status === 'failed'
              ? 'failed'
              : coverage?.status === 'running'
                ? 'searching'
                : 'none';
          const freshness = summary ? formatRelativeTime(summary.latestCreatedAt) : null;
          const title = summary
            ? `${country.name_ja} ${summary.topicCount}件: ${summary.topUpdate.headline_ja}${freshness ? `（${freshness}）` : ''}`
            : coverage?.status === 'failed'
              ? `${country.name_ja}: 取得失敗`
              : coverage?.status === 'running'
                ? `${country.name_ja}: 調査中`
                : `${country.name_ja}: 表示条件に合う情報なし`;

          return (
            <button
              key={country.code}
              className={`map-pin ${stateClass} ${isActive ? 'active' : ''}`}
              style={{ left: `${(point[0] / MAP_WIDTH) * 100}%`, top: `${(point[1] / MAP_HEIGHT) * 100}%` }}
              type="button"
              disabled={!summary}
              title={title}
              aria-label={title}
              onClick={() => summary && onSelectCountry(country.code)}
            >
              <span>{summary ? (summary.topicCount > 1 ? summary.topicCount : Math.round(summary.maxImportance / 10)) : ''}</span>
            </button>
          );
        })}
        <div className="legend">
          <span><i className="high" />高</span>
          <span><i className="mid" />中</span>
          <span><i className="low" />低</span>
          <span><i className="failed" />取得失敗</span>
          <span><i className="none" />情報なし</span>
        </div>
      </div>
    </section>
  );
}
