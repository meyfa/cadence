import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { lezer } from '@lezer/generator/rollup'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    lezer()
  ],
  resolve: {
    alias: {
      '@core': path.resolve(import.meta.dirname, '../core/src'),
      '@language': path.resolve(import.meta.dirname, '../language/src'),
      '@editor': path.resolve(import.meta.dirname, '../editor/src')
    }
  },
  build: {
    outDir: 'dist'
  }
})
