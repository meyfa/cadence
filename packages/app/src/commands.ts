import type { AudioEngine } from '@core/audio/engine.js'
import type { Program } from '@core/program.js'
import { usePrevious } from './hooks/previous.js'
import { useAudioEngine } from './state/AudioEngineContext.js'
import { useCompilationState } from './state/CompilationContext.js'
import { useLayout, type LayoutDispatch } from './state/LayoutContext.js'
import { defaultLayout } from './state/default-layout.js'
import { applyThemeSetting } from './theme.js'

export interface Command {
  readonly id: string
  readonly label: string
  readonly action: (context: CommandContext) => void
}

export interface CommandContext {
  readonly layoutDispatch: LayoutDispatch
  readonly audioEngine: AudioEngine
  readonly lastProgram: Program | undefined
}

export function useCommandContext (): CommandContext {
  const [, layoutDispatch] = useLayout()

  const audioEngine = useAudioEngine()

  const { program: currentProgram } = useCompilationState()
  const lastProgram = usePrevious(currentProgram)

  return {
    layoutDispatch,
    audioEngine,
    lastProgram
  }
}

export const commands: readonly Command[] = Object.freeze([
  {
    id: 'playback.toggle',
    label: 'Playback: Toggle (play/stop)',
    action: ({ audioEngine, lastProgram }) => {
      if (audioEngine.playing.get()) {
        audioEngine.stop()
      } else if (lastProgram != null) {
        audioEngine.play(lastProgram)
      }
    }
  },

  {
    id: 'theme.dark',
    label: 'Theme: Dark',
    action: () => {
      applyThemeSetting('dark')
    }
  },

  {
    id: 'theme.light',
    label: 'Theme: Light',
    action: () => {
      applyThemeSetting('light')
    }
  },

  {
    id: 'theme.system',
    label: 'Theme: System',
    action: () => {
      applyThemeSetting('system')
    }
  },

  {
    id: 'layout.reset',
    label: 'Layout: Reset to default',
    action: ({ layoutDispatch }) => {
      layoutDispatch(defaultLayout)
    }
  }
])
