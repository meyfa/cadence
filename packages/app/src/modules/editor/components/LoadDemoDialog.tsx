import type { DialogComponentProps, PanelId } from '@meyfa/cadence-editor'
import { activateTabOfType, setProjectFileContent, useLayoutDispatch, useProjectSourceDispatch } from '@meyfa/cadence-editor'
import type { FunctionComponent } from 'react'
import { useCallback } from 'react'
import { ConfirmationDialog } from '../../../components/dialog/ConfirmationDialog.tsx'
import { demoCode } from '../../../defaults/demo-code.ts'
import { TRACK_FILE_PATH } from '../../../persistence/constants.ts'
import type { EditorPanelProps } from '../panel-props.ts'
import { useEditorDispatch } from '../provider.tsx'

export const LoadDemoDialog: FunctionComponent<DialogComponentProps & {
  editorPanelId: PanelId
}> = ({ open, onClose, editorPanelId }) => {
  const sourceDispatch = useProjectSourceDispatch()
  const editorDispatch = useEditorDispatch()
  const layoutDispatch = useLayoutDispatch()

  const onConfirm = useCallback(() => {
    sourceDispatch((state) => setProjectFileContent(state, TRACK_FILE_PATH, demoCode))
    editorDispatch((state) => ({
      ...state,
      carets: {}
    }))
    layoutDispatch((layout) => activateTabOfType(layout, editorPanelId, () => ({
      type: editorPanelId,
      props: { filePath: TRACK_FILE_PATH } satisfies EditorPanelProps
    })))
    onClose()
  }, [sourceDispatch, editorDispatch, layoutDispatch, editorPanelId, onClose])

  const title = 'Load demo project?'

  return (
    <ConfirmationDialog open={open} onConfirm={onConfirm} onCancel={onClose} title={title}>
      This will delete your current project. Continue?
    </ConfirmationDialog>
  )
}
