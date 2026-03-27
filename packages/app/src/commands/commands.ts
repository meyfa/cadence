import type { Program } from '@core'
import { useLayout, type KeyboardShortcut, type LayoutDispatch } from '@editor'
import type { Brand } from '@utility'
import type { AudioEngine } from '@webaudio'
import { usePrevious } from '../hooks/previous.js'
import { useAudioEngine } from '../state/AudioEngineContext.js'
import { useCompilationState } from '../state/CompilationContext.js'
import { useDialog } from '../state/DialogContext.js'
import { useEditor, type EditorDispatch, type EditorState } from '../state/EditorContext.js'

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
  readonly showDialog: (component: any, props?: Record<string, unknown>) => () => void
}

export function useCommandContext (): CommandContext {
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
    showDialog
  }
}
