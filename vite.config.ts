import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  /** GitHub Pages: https://maggiecycy.github.io/dj-booth/ */
  base: process.env.GITHUB_PAGES === 'true' ? '/dj-booth/' : '/',
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
  },
})
