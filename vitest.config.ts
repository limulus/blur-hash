import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [
        { browser: 'chromium' },
        { browser: 'webkit' },
        // On macOS, Playwright's Firefox shares ~/Library/Application Support/Firefox with
        // the Firefox app, and macOS can refuse it access ("Could not find profile folder"),
        // so only CI runs it. Run it everywhere once Playwright 1.65 ships with the fix:
        // https://github.com/microsoft/playwright/issues/42768
        ...(process.env.CI ? [{ browser: 'firefox' as const }] : []),
      ],
    },
    coverage: {
      // V8 coverage works only in Chromium, so `npm test` collects it from a Chromium run
      // and then runs the other browsers without it.
      provider: 'v8',
      reporter: ['html', 'json', 'text', 'text-summary'],
      include: ['src/**/*.ts'],
      exclude: ['**/node_modules/**', '**/mocks/**', '**/*.spec.ts'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
  // Pre-bundle the worker's dependency up front; discovering it mid-run makes Vite reload.
  optimizeDeps: { include: ['fast-blurhash'] },
})
