import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const rootDir = fileURLToPath(new URL('../../', import.meta.url))

function fromRoot (...segments: string[]): string {
  return path.resolve(rootDir, ...segments)
}

export default defineConfig({
  resolve: {
    alias: {
      '@audiograph': fromRoot('packages/audiograph/src/index.ts'),
      '@core': fromRoot('packages/core/src/index.ts'),
      '@utility': fromRoot('packages/utility/src/index.ts'),
      '@webaudio': fromRoot('packages/webaudio/src/index.ts')
    }
  },

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
