import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Separate from the default config because this suite needs a running API (see e2e/flow.test.jsx).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: false,
    include: ['e2e/**/*.test.jsx'],
    testTimeout: 60000,
  },
});
