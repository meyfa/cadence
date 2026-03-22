import { lezer } from '@lezer/generator/rollup'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { defineConfig } from 'vite'

const config = defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    lezer()
  ],
  resolve: {
    alias: {
      '@utility': path.resolve(import.meta.dirname, '../utility/src/index.ts'),
      '@core': path.resolve(import.meta.dirname, '../core/src/index.ts'),
      '@audiograph': path.resolve(import.meta.dirname, '../audiograph/src/index.ts'),
      '@ast': path.resolve(import.meta.dirname, '../ast/src/index.ts'),
      '@codecs': path.resolve(import.meta.dirname, '../codecs/src/index.ts'),
      '@webaudio': path.resolve(import.meta.dirname, '../webaudio/src/index.ts'),
      '@language': path.resolve(import.meta.dirname, '../language/src/index.ts'),
      '@language-support': path.resolve(import.meta.dirname, '../language-support/src/index.ts'),
      '@editor': path.resolve(import.meta.dirname, '../editor/src/index.ts'),
      '@flowchart': path.resolve(import.meta.dirname, '../flowchart/src/index.ts')
    }
  },
  build: {
    outDir: 'dist'
  }
})

export default config

// Ensure that the above aliases are in sync with tsconfig.base.json
const tsconfigPath = path.resolve(import.meta.dirname, '../../tsconfig.base.json')
const tsconfig = JSON.parse(await readFile(tsconfigPath, 'utf-8'))
const tsconfigPaths = Object.keys(tsconfig.compilerOptions.paths)
const viteAliases = Object.keys(config.resolve?.alias ?? {})

assert.deepStrictEqual(
  viteAliases.sort(),
  tsconfigPaths.sort(),
  'The path aliases in vite.config.ts are out of sync with tsconfig.base.json'
)
