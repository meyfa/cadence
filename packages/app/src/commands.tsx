import type { Program } from '@core'
import { useCommandRegistry, useLayout, type Command, type CommandId, type LayoutDispatch } from '@editor'
import type { AudioEngine } from '@webaudio'
import { useCallback, useMemo } from 'react'
import { usePrevious } from './hooks/previous.js'
import { useAudioEngine } from './state/AudioEngineContext.js'
import { useCompilationState } from './state/CompilationContext.js'
import { useDialog } from './state/DialogContext.js'
import { useEditor, type EditorDispatch, type EditorState } from './state/EditorContext.js'

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

export type DispatchCommand = (command: Command<CommandContext>) => void
export type DispatchCommandById = (id: CommandId) => void

export interface TypedCommandDispatch {
  readonly dispatchCommand: DispatchCommand
  readonly dispatchCommandById: DispatchCommandById
}

export function useTypedCommandDispatch (): TypedCommandDispatch {
  const {
    dispatchCommand: dispatch,
    dispatchCommandById: dispatchById
  } = useCommandRegistry()

  const context = useCommandContext()

  const dispatchCommand = useCallback((command: Command<CommandContext>) => {
    dispatch(command as any, context)
  }, [dispatch, context])

  const dispatchCommandById = useCallback((id: CommandId) => {
    dispatchById(id as any, context)
  }, [dispatchById, context])

  return useMemo(() => ({
    dispatchCommand,
    dispatchCommandById
  }), [dispatchCommand, dispatchCommandById])
}
