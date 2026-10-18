import type { FooterInsert, MenuId, MenuSectionId, Module, Problem } from '@meyfa/cadence-editor'
import { useDialogService, useLayout, useLayoutDispatch, useProvideProblems, useRegisterCommand } from '@meyfa/cadence-editor'
import type { FunctionComponent } from 'react'
import { useMemo } from 'react'
import { useCompilationState } from '../../compilation/CompilationContext.tsx'
import { getFocusedEditorCaret } from './caret.ts'
import { createFileOpenCommand, createFileSaveCommand, createGoToDefinitionCommand, createLoadDemoCommand, createShowEditorCommand, fileOpenId, fileSaveId, useEditorRef, viewEditorId } from './commands.ts'
import { EditorPanel } from './components/EditorPanel.tsx'
import { ResetProjectSettingsCard } from './components/ResetProjectSettingsCard.tsx'
import { editorPanelId, moduleId } from './ids.ts'
import { getEditorPanelProps } from './panel-props.ts'
import { EditorProvider, useEditor } from './provider.tsx'

const fileMenuId = 'file' as MenuId
const viewShowSectionId = 'view.show' as MenuSectionId
const fileSaveSectionId = 'file.save' as MenuSectionId

const GlobalHooks: FunctionComponent = () => {
  const layoutDispatch = useLayoutDispatch()
  const { showDialog } = useDialogService()

  const editorRef = useEditorRef()

  useRegisterCommand(() => createShowEditorCommand(layoutDispatch), [layoutDispatch])
  useRegisterCommand(() => createFileOpenCommand(editorRef), [])
  useRegisterCommand(() => createFileSaveCommand(editorRef), [])
  useRegisterCommand(() => createLoadDemoCommand(showDialog), [showDialog])
  useRegisterCommand(() => createGoToDefinitionCommand(editorRef), [])

  const { result: { errors } } = useCompilationState()

  const problems = useMemo(() => {
    return errors.map((error): Problem => ({
      kind: 'error',
      label: 'Compiler',
      message: error.message,
      range: error.range,
      error
    }))
  }, [errors])

  useProvideProblems(problems)

  return null
}

const caretFooterInsert: FooterInsert = {
  commandId: viewEditorId,
  position: 'end',
  Label: () => {
    const layout = useLayout()
    const editor = useEditor()
    const caret = getFocusedEditorCaret(layout, editorPanelId, editor.carets)
    return `Ln ${caret?.line ?? '-'}, Col ${caret?.column ?? '-'}`
  }
}

export const editorModule: Module = {
  id: moduleId,

  Provider: EditorProvider,

  GlobalHooks,

  panels: [
    {
      id: editorPanelId,
      closeable: false,
      Panel: EditorPanel,
      Title: ({ panelProps }) => {
        const { filePath } = getEditorPanelProps(panelProps)
        return filePath.split('/').pop() ?? filePath
      }
    }
  ],

  menu: {
    sections: [
      {
        id: fileSaveSectionId,
        menuId: fileMenuId
      }
    ],

    items: [
      {
        sectionId: viewShowSectionId,
        commandId: viewEditorId,
        label: 'Editor'
      },
      {
        sectionId: fileSaveSectionId,
        commandId: fileOpenId,
        label: 'Open…'
      },
      {
        sectionId: fileSaveSectionId,
        commandId: fileSaveId,
        label: 'Save…'
      }
    ]
  },

  settings: {
    cards: [
      ResetProjectSettingsCard
    ]
  },

  inserts: {
    footer: [
      caretFooterInsert
    ]
  }
}
