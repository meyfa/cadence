import type { AudioEngine } from '@core/audio/engine.js'
import type { Program } from '@core/program.js'
import { normalizeKeyboardShortcut, type KeyboardShortcut } from '@editor/keyboard-shortcuts.js'
import { activateTabOfType } from './hooks/layout.js'
import { usePrevious } from './hooks/previous.js'
import { TabTypes } from './panes/render-tab.js'
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

export function getCommandById (id: string): Command | undefined {
  return commandsById.get(id)
}

export function findCommandForKeyboardShortcut (shortcut: KeyboardShortcut): Command | undefined {
  return keyboardShortcuts.get(shortcut)
}

export const CommandId = Object.freeze({
  PlaybackToggle: 'playback.toggle',
  ViewEditor: 'view.editor',
  ViewMixer: 'view.mixer',
  ViewSettings: 'view.settings',
  ViewProblems: 'view.problems',
  ViewTimeline: 'view.timeline',
  ThemeDark: 'theme.dark',
  ThemeLight: 'theme.light',
  ThemeSystem: 'theme.system',
  LayoutReset: 'layout.reset',
  CommandsShowAll: 'commands.show-all'
} as const)

export const commands: readonly Command[] = Object.freeze([
  {
    id: CommandId.PlaybackToggle,
    label: 'Playback: Toggle (play/stop)',
    keyboardShortcuts: [
      'Ctrl+Shift+Space'
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
    id: CommandId.ViewSettings,
    label: 'Show view: Settings',
    action: ({ layoutDispatch }) => {
      activateTabOfType(layoutDispatch, TabTypes.Settings)
    }
  },

  {
    id: CommandId.ViewEditor,
    label: 'Show view: Editor',
    action: ({ layoutDispatch }) => {
      activateTabOfType(layoutDispatch, TabTypes.Editor)
    }
  },

  {
    id: CommandId.ViewMixer,
    label: 'Show view: Mixer',
    action: ({ layoutDispatch }) => {
      activateTabOfType(layoutDispatch, TabTypes.Mixer)
    }
  },

  {
    id: CommandId.ViewProblems,
    label: 'Show view: Problems',
    action: ({ layoutDispatch }) => {
      activateTabOfType(layoutDispatch, TabTypes.Problems)
    }
  },

  {
    id: CommandId.ViewTimeline,
    label: 'Show view: Timeline',
    action: ({ layoutDispatch }) => {
      activateTabOfType(layoutDispatch, TabTypes.Timeline)
    }
  },

  {
    id: CommandId.ThemeDark,
    label: 'Theme: Dark',
    action: () => {
      applyThemeSetting('dark')
    }
  },

  {
    id: CommandId.ThemeLight,
    label: 'Theme: Light',
    action: () => {
      applyThemeSetting('light')
    }
  },

  {
    id: CommandId.ThemeSystem,
    label: 'Theme: System',
    action: () => {
      applyThemeSetting('system')
    }
  },

  {
    id: CommandId.LayoutReset,
    label: 'Layout: Reset to default',
    action: ({ layoutDispatch }) => {
      layoutDispatch(defaultLayout)
    }
  },

  {
    id: CommandId.CommandsShowAll,
    label: 'Show all commands',
    keyboardShortcuts: [
      // Ctrl-Shift-P may be reserved by some browsers
      'Ctrl+P',
      'Ctrl+Shift+P',
      'F1'
    ],
    action: ({ showCommandPalette }) => {
      showCommandPalette()
    }
  }
] satisfies Command[])

const commandsById = ((): ReadonlyMap<string, Command> => {
  const map = new Map<string, Command>()
  for (const command of commands) {
    map.set(command.id, command)
  }
  return map
})()

const keyboardShortcuts = ((): ReadonlyMap<KeyboardShortcut, Command> => {
  const map = new Map<KeyboardShortcut, Command>()
  for (const command of commands) {
    for (const unnormalizedShortcut of command.keyboardShortcuts ?? []) {
      const shortcut = normalizeKeyboardShortcut(unnormalizedShortcut)

      const existing = map.get(shortcut)
      if (existing != null) {
        // Throwing is okay here since all commands are defined statically
        throw new Error(`Keyboard shortcut conflict: ${JSON.stringify(shortcut)} is assigned to both ${JSON.stringify(existing.id)} and ${JSON.stringify(command.id)}`)
      }

      map.set(shortcut, command)
    }
  }
  return map
})()
