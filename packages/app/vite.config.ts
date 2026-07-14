import { lezer } from '@lezer/generator/rollup'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const config = defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    lezer()
  ],
  build: {
    outDir: 'dist',

    license: {
      fileName: 'license.md'
    },

    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor',
              test: /node_modules/
            }
          ]
        }
      }
    },

    // Exclude audio worklet processors from inlining, as the Content Security Policy
    // may prevent loading them from base64-encoded data URLs.
    assetsInlineLimit: (filePath) => {
      if (filePath.endsWith('.worklet.js')) {
        return false
      }
    }
  }
})

export default config
