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
