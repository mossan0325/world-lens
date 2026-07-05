// GitHub Pages 向けビルド(vite --mode staticdemo)ではAPIサーバーの代わりに
// 同梱のスナップショットJSONを読む。フラグは .env.staticdemo で注入される。
export const STATIC_DEMO: boolean = import.meta.env.VITE_STATIC_DEMO === 'true';

export const SNAPSHOT_URL = `${import.meta.env.BASE_URL}demo/latest.json`;

export const REPO_URL = 'https://github.com/mossan0325/world-lens';
