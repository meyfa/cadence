import { BrowserLocalStorage, CommandRegistryProvider, LayoutProvider, MenuProvider, ModuleProvider, parseEditorState, serializeEditorState, type CadenceEditorState, type MenuId } from '@editor'
import type { CompileOptions } from '@language'
import { numeric } from '@utility'
import { createAudioEngine, type AudioEngineOptions } from '@webaudio'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
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
import { AudioEngineContext } from './state/AudioEngineContext.js'
import { CompilationProvider } from './state/CompilationContext.js'
import { DialogProvider } from './state/DialogContext.js'
import { EditorProvider } from './state/EditorContext.js'

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

const menus = [
  {
    id: 'file' as MenuId,
    label: 'File'
  },
  {
    id: 'view' as MenuId,
    label: 'View'
  }
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
    <LayoutProvider>
      <AudioEngineContext value={engine}>
        <EditorProvider>
          <CompilationProvider compileOptions={compileOptions}>
            <DialogProvider>
              <CommandRegistryProvider>
                <MenuProvider menus={menus}>
                  <ModuleProvider modules={modules}>
                    <App storage={storage} initialState={initialState} />
                  </ModuleProvider>
                </MenuProvider>
              </CommandRegistryProvider>
            </DialogProvider>
          </CompilationProvider>
        </EditorProvider>
      </AudioEngineContext>
    </LayoutProvider>
  </StrictMode>
)
