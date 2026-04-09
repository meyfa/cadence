import { activateTabOfType, useLayoutDispatch, type DialogComponentProps, type PanelId } from '@editor'
import { useCallback, type FunctionComponent } from 'react'
import { ConfirmationDialog } from '../../../components/dialog/ConfirmationDialog.js'
import { demoCode } from '../../../defaults/demo-code.js'
import { useProjectSourceDispatch } from '../../../project-source/ProjectSourceContext.js'
import { setProjectFileContent, TRACK_FILE_PATH } from '../../../project-source/model.js'
import { useEditorDispatch } from '../provider.js'
import type { EditorPanelProps } from '../panel-props.js'

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
      carets: {
        ...state.carets,
        [TRACK_FILE_PATH]: undefined
      }
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
