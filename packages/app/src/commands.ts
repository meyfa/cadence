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
  readonly keyboardShortcuts?: readonly KeyboardShortcut[]
  readonly action: (context: CommandContext) => void
}

export interface CommandContext {
  readonly layoutDispatch: LayoutDispatch
  readonly audioEngine: AudioEngine
  readonly lastProgram: Program | undefined
  readonly showCommandPalette: () => void
}

export interface KeyboardShortcut {
  readonly ctrl?: boolean
  readonly shift?: boolean
  readonly alt?: boolean
  readonly code: string
}

export function useCommandContext (handlers: {
  showCommandPalette: () => void
}): CommandContext {
  const [, layoutDispatch] = useLayout()

  const audioEngine = useAudioEngine()

  const { program: currentProgram } = useCompilationState()
  const lastProgram = usePrevious(currentProgram)

  return {
    layoutDispatch,
    audioEngine,
    lastProgram,
    showCommandPalette: handlers.showCommandPalette
  }
}

export function matchKeyboardShortcut (details: Required<KeyboardShortcut>, shortcut: KeyboardShortcut): boolean {
  return (
    (shortcut.ctrl == null || details.ctrl === shortcut.ctrl) &&
    (shortcut.shift == null || details.shift === shortcut.shift) &&
    (shortcut.alt == null || details.alt === shortcut.alt) &&
    details.code === shortcut.code
  )
}

export function findCommandForKeyboardShortcut (details: Required<KeyboardShortcut>): Command | undefined {
  return commands.find((command) => {
    if (command.keyboardShortcuts == null) {
      return false
    }

    return command.keyboardShortcuts.some((shortcut) => matchKeyboardShortcut(details, shortcut))
  })
}

export function formatKeyCode (code: string): string {
  if (code.startsWith('Key')) {
    return code.slice(3)
  }

  return code
}

export const commands: readonly Command[] = Object.freeze([
  {
    id: 'playback.toggle',
    label: 'Playback: Toggle (play/stop)',
    keyboardShortcuts: [
      { ctrl: true, shift: true, code: 'Space' }
    ],
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
  },

  {
    id: 'commands.show-all',
    label: 'Show all commands',
    keyboardShortcuts: [
      // Ctrl-Shift-P may be reserved by some browsers
      { ctrl: true, code: 'KeyP' },
      { code: 'F1' }
    ],
    action: ({ showCommandPalette }) => {
      showCommandPalette()
    }
  }
])
