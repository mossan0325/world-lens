import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// staticdemo モード = GitHub Pages 向け静的デモビルド(base はリポジトリ名のサブパス)。
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'staticdemo' ? '/world-lens/' : '/',
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
}))
