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
      '@collections': path.resolve(import.meta.dirname, '../collections/src'),
      '@core': path.resolve(import.meta.dirname, '../core/src'),
      '@webaudio': path.resolve(import.meta.dirname, '../webaudio/src'),
      '@language': path.resolve(import.meta.dirname, '../language/src'),
      '@editor': path.resolve(import.meta.dirname, '../editor/src'),
      '@flowchart': path.resolve(import.meta.dirname, '../flowchart/src')
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
const tsconfigPaths = Object.keys(tsconfig.compilerOptions.paths).map((key) => {
  return key.replace('/*', '')
})
const viteAliases = Object.keys(config.resolve?.alias ?? {})

assert.deepStrictEqual(
  viteAliases.sort(),
  tsconfigPaths.sort(),
  'The path aliases in vite.config.ts are out of sync with tsconfig.base.json'
)
