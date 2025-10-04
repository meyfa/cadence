import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { lezer } from '@lezer/generator/rollup'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    lezer()
  ],
  build: {
    outDir: 'dist'
  }
})
