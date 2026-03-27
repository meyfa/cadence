import { createAudioGraph } from '@audiograph'
import { type Program } from '@core'
import { normalizeKeyboardShortcut, useLayout, type KeyboardShortcut, type LayoutDispatch } from '@editor'
import { numeric, type Brand } from '@utility'
import type { AudioEngine } from '@webaudio'
import { ExportDialog } from '../components/dialogs/ExportDialog.js'
import { defaultLayout } from '../defaults/default-layout.js'
import { usePrevious } from '../hooks/previous.js'
import { modules } from '../modules/index.js'
import { useAudioEngine } from '../state/AudioEngineContext.js'
import { useCompilationState } from '../state/CompilationContext.js'
import { useDialog } from '../state/DialogContext.js'
import { useEditor, type EditorDispatch, type EditorState } from '../state/EditorContext.js'
import { applyThemeSetting } from '../theme.js'
import { openTextFile, saveTextFile } from '../utilities/files.js'
import { CommandIds } from './ids.js'

export type CommandId = Brand<string, 'app.CommandId'>

export interface Command {
  readonly id: CommandId
  readonly label: string
  readonly keyboardShortcuts?: readonly KeyboardShortcut[]
  readonly action: (context: CommandContext) => void
}

export interface CommandContext {
  readonly layoutDispatch: LayoutDispatch
  readonly audioEngine: AudioEngine
  readonly editor: {
    readonly state: EditorState
    readonly dispatch: EditorDispatch
  }
  readonly lastProgram: Program | undefined
  readonly showCommandPalette: () => void
  readonly showDialog: (component: any, props?: Record<string, unknown>) => () => void
}

export function useCommandContext (handlers: {
  showCommandPalette: () => void
}): CommandContext {
  const [, layoutDispatch] = useLayout()

  const audioEngine = useAudioEngine()

  const [editor, editorDispatch] = useEditor()

  const { showDialog } = useDialog()

  const { program: currentProgram } = useCompilationState()
  const lastProgram = usePrevious(currentProgram)

  return {
    layoutDispatch,
    audioEngine,
    editor: {
      state: editor,
      dispatch: editorDispatch
    },
    lastProgram,
    showCommandPalette: handlers.showCommandPalette,
    showDialog
  }
}

export function getCommandById (id: CommandId): Command | undefined {
  return commandsById.get(id)
}

export function findCommandForKeyboardShortcut (shortcut: KeyboardShortcut): Command | undefined {
  return keyboardShortcuts.get(shortcut)
}

const DEFAULT_FILENAME = 'track.cadence'
const FILE_ACCEPT = '.cadence,text/plain'
const FILE_OPEN_TIMEOUT = numeric('s', 5)

export const commands: readonly Command[] = Object.freeze([
  {
    id: CommandIds.PlaybackToggle,
    label: 'Playback: Toggle (play/stop)',
    keyboardShortcuts: [
      'Ctrl+Shift+Space'
    ],
    action: ({ audioEngine, lastProgram }) => {
      if (audioEngine.playing.get()) {
        audioEngine.stop()
      } else if (lastProgram != null) {
        audioEngine.play(createAudioGraph(lastProgram))
      }
    }
  },

  {
    id: CommandIds.FileOpen,
    label: 'File: Open',
    keyboardShortcuts: [
      'Ctrl+O'
    ],
    action: ({ editor }) => {
      openTextFile({
        accept: FILE_ACCEPT,
        signal: AbortSignal.timeout(FILE_OPEN_TIMEOUT.value * 1000)
      }).then((content) => {
        if (content != null) {
          editor.dispatch((state) => ({
            ...state,
            code: content,
            caret: undefined
          }))
        }
      }).catch(() => {
        // ignore errors
      })
    }
  },

  {
    id: CommandIds.FileSave,
    label: 'File: Save',
    keyboardShortcuts: [
      'Ctrl+S'
    ],
    action: ({ editor }) => {
      saveTextFile({
        filename: DEFAULT_FILENAME,
        content: editor.state.code
      })
    }
  },

  {
    id: CommandIds.FileExport,
    label: 'File: Export',
    keyboardShortcuts: [
      'Ctrl+E'
    ],
    action: ({ showDialog }) => {
      showDialog(ExportDialog)
    }
  },

  {
    id: CommandIds.ThemeDark,
    label: 'Theme: Dark',
    action: () => {
      applyThemeSetting('dark')
    }
  },

  {
    id: CommandIds.ThemeLight,
    label: 'Theme: Light',
    action: () => {
      applyThemeSetting('light')
    }
  },

  {
    id: CommandIds.ThemeSystem,
    label: 'Theme: System',
    action: () => {
      applyThemeSetting('system')
    }
  },

  {
    id: CommandIds.LayoutReset,
    label: 'Layout: Reset to default',
    action: ({ layoutDispatch }) => {
      layoutDispatch(defaultLayout)
    }
  },

  {
    id: CommandIds.CommandsShowAll,
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
  },

  ...modules.flatMap((module) => module.commands ?? [])
] satisfies Command[])

const commandsById = ((): ReadonlyMap<CommandId, Command> => {
  const map = new Map<CommandId, Command>()
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
