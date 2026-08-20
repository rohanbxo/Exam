import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const PROXY_PATHS = [
  '/upload',
  '/scrape_and_index',
  '/documents',
  '/stream_query',
  '/query',
  '/summarize',
  '/reset',
  '/status',
  '/sessions',
]

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(
      PROXY_PATHS.map((path) => [
        path,
        {
          target: 'http://localhost:7860',
          changeOrigin: true,
        },
      ]),
    ),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
