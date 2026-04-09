import { CommonProvider, createLocalStorageBackend, DialogHost, ModuleHost, NotificationHost, PersistenceEngine } from '@editor'
import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import type { CompileOptions } from '@language'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import { CompilationProvider } from './components/contexts/CompilationContext.js'
import { getCspNonce } from './csp.js'
import './index.css'
import { commandPaletteModule } from './modules/command-palette/index.js'
import { editorModule } from './modules/editor/index.js'
import { exportModule } from './modules/export/index.js'
import { mixerModule } from './modules/mixer/index.js'
import { playbackModule } from './modules/playback/index.js'
import { problemsModule } from './modules/problems/index.js'
import { settingsModule } from './modules/settings/index.js'
import { viewModule } from './modules/view/index.js'
import { defaultThemeSetting } from './modules/view/persistence.js'
import { ProjectSourceProvider } from './project-source/ProjectSourceContext.js'
import { appPersistenceDefaults } from './persistence/persistence.js'
import { applyThemeSetting } from './theme.js'

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

const compileOptions: CompileOptions = {
  beatsPerBar: 4,
  tempo: {
    default: 128,
    minimum: 1,
    maximum: 400
  }
}

applyThemeSetting(defaultThemeSetting)

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
      <CommonProvider persistenceEngine={persistenceEngine} initialLayout={appPersistenceDefaults.layout} modules={modules}>
        <ProjectSourceProvider initialState={appPersistenceDefaults.source}>
          <CompilationProvider compileOptions={compileOptions}>
            <App />
            <DialogHost />
            <NotificationHost />
            <ModuleHost />
          </CompilationProvider>
        </ProjectSourceProvider>
      </CommonProvider>
    </CacheProvider>
  </StrictMode>
)
