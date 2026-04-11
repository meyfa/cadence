import path from 'node:path'
import { defineConfig } from 'vitest/config'

const packagesDir = path.resolve(import.meta.dirname, '..')

export default defineConfig({
  resolve: {
    alias: {
      '@utility': path.resolve(packagesDir, 'utility/src/index.ts')
    }
  },

  test: {
    environment: 'jsdom',
    include: ['test/**/*.spec.ts?(x)'],
    setupFiles: ['./test/setup-dom.ts']
  }
})
