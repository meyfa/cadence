import { CommonProvider, DialogHost, ModuleHost } from '@editor'
import type { CompileOptions } from '@language'
import { numeric } from '@utility'
import { createAudioEngine, type AudioEngineOptions } from '@webaudio'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import { AudioEngineContext } from './components/contexts/AudioEngineContext.js'
import { CompilationProvider } from './components/contexts/CompilationContext.js'
import { EditorProvider } from './components/contexts/EditorContext.js'
import { defaultLayout } from './defaults/default-layout.js'
import { demoCode } from './defaults/demo-code.js'
import './index.css'
import { commandPaletteModule } from './modules/command-palette/index.js'
import { editorModule } from './modules/editor/index.js'
import { exportModule } from './modules/export/index.js'
import { mixerModule } from './modules/mixer/index.js'
import { problemsModule } from './modules/problems/index.js'
import { settingsModule } from './modules/settings/index.js'
import { timelineModule } from './modules/timeline/index.js'
import { viewModule } from './modules/view/index.js'
import { parseEditorState, serializeEditorState, type CadenceEditorState } from './state/state.js'
import { BrowserLocalStorage } from './state/storage.js'

const modules = [
  commandPaletteModule,
  editorModule,
  exportModule,
  mixerModule,
  problemsModule,
  settingsModule,
  viewModule,
  timelineModule
]

const compileOptions: CompileOptions = {
  beatsPerBar: 4,
  tempo: {
    default: 128,
    minimum: 1,
    maximum: 400
  }
}

const lowMemoryDevice = 'deviceMemory' in navigator
  ? (navigator as any).deviceMemory <= 2
  : undefined

const likelyMobile = 'userAgentData' in navigator && 'mobile' in (navigator as any).userAgentData
  ? (navigator as any).userAgentData.mobile === true
  : matchMedia('(pointer: coarse)').matches && Math.min(window.screen.width, window.screen.height) <= 768

const audioEngineOptions = {
  assetLoadTimeout: numeric('s', 5),
  cacheLimits: lowMemoryDevice === true || likelyMobile
    ? {
        arrayBuffer: numeric('bytes', 60 * 1024 * 1024), // compressed: 60 MB
        audioBuffer: numeric('bytes', 30 * 1024 * 1024) // decompressed: 30 MB
      }
    : {
        arrayBuffer: numeric('bytes', 200 * 1024 * 1024), // compressed: 200 MB
        audioBuffer: numeric('bytes', 100 * 1024 * 1024) // decompressed: 100 MB
      }
} satisfies Partial<AudioEngineOptions>

const defaultState: CadenceEditorState = {
  settings: {
    theme: 'dark',
    outputGain: numeric('db', -12)
  },
  layout: defaultLayout,
  code: demoCode
}

const STORAGE_KEY = 'cadence-editor'
const storage = new BrowserLocalStorage(STORAGE_KEY, serializeEditorState, parseEditorState)
const storedState = storage.load()

const initialState: CadenceEditorState = {
  settings: {
    theme: storedState?.settings?.theme ?? defaultState.settings.theme,
    outputGain: storedState?.settings?.outputGain ?? defaultState.settings.outputGain
  },
  layout: storedState?.layout ?? defaultState.layout,
  code: storedState?.code ?? defaultState.code
}

const engine = createAudioEngine({
  ...audioEngineOptions,
  outputGain: initialState.settings.outputGain
})

const container = document.getElementById('root')
if (container == null) {
  throw new Error('container == null')
}

const root = createRoot(container)

root.render(
  <StrictMode>
    <CommonProvider modules={modules}>
      <AudioEngineContext value={engine}>
        <EditorProvider>
          <CompilationProvider compileOptions={compileOptions}>
            <App storage={storage} initialState={initialState} />
            <DialogHost />
            <ModuleHost />
          </CompilationProvider>
        </EditorProvider>
      </AudioEngineContext>
    </CommonProvider>
  </StrictMode>
)
