import { CommonProvider, createLocalStorageBackend, DialogHost, ModuleHost, NotificationHost, PersistenceEngine } from '@meyfa/cadence-editor'
import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import type { GenerateOptions } from '@meyfa/cadence-language'
import type { Numeric } from '@meyfa/cadence-utility'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { CompilationProvider } from './compilation/CompilationContext.tsx'
import { getCspNonce } from './csp.ts'
import './index.css'
import { commandPaletteModule } from './modules/command-palette/index.ts'
import { editorModule } from './modules/editor/index.ts'
import { exportModule } from './modules/export/index.tsx'
import { mixerModule } from './modules/mixer/index.ts'
import { playbackModule } from './modules/playback/index.ts'
import { problemsModule } from './modules/problems/index.ts'
import { settingsModule } from './modules/settings/index.ts'
import { viewModule } from './modules/view/index.ts'
import { applyThemeSetting } from './theme.ts'

const modules = [
  commandPaletteModule,
  editorModule,
  exportModule,
  mixerModule,
  problemsModule,
  settingsModule,
  viewModule,
  playbackModule
]

const compileOptions: GenerateOptions = {
  beatsPerBar: 4,
  tempo: {
    default: 128 as Numeric<'bpm'>,
    minimum: 1 as Numeric<'bpm'>,
    maximum: 400 as Numeric<'bpm'>
  }
}

// While the persistence is loading, apply the system theme.
applyThemeSetting('system', { immediate: true })

const emotionCache = createCache({
  key: 'cadence',
  nonce: getCspNonce()
})

const persistenceEngine = new PersistenceEngine(createLocalStorageBackend({
  prefix: 'cadence'
}))

const container = document.getElementById('root')
if (container == null) {
  throw new Error('container == null')
}

const root = createRoot(container)

root.render(
  <StrictMode>
    <CacheProvider value={emotionCache}>
      <CommonProvider persistenceEngine={persistenceEngine} modules={modules}>
        <CompilationProvider compileOptions={compileOptions}>
          <App />
          <DialogHost />
          <NotificationHost />
          <ModuleHost />
        </CompilationProvider>
      </CommonProvider>
    </CacheProvider>
  </StrictMode>
)
