import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In development the API runs on :4000. Proxying /api keeps everything on one origin,
// so the HTTP-only session cookie works without any CORS setup.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: false,
    // The end-to-end test needs a running API, so it has its own command (npm run test:e2e).
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
