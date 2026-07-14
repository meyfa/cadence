import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test-browser/**/*.test.ts'],

    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      screenshotFailures: false,
      instances: [
        {
          browser: 'chromium'
        }
      ]
    }
  }
})
