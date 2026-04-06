import { activateTabOfType, useLayoutDispatch, type DialogComponentProps, type PanelId } from '@editor'
import { useCallback, type FunctionComponent } from 'react'
import { useEditorDispatch } from '../../components/contexts/EditorContext.js'
import { ConfirmationDialog } from '../../components/dialog/ConfirmationDialog.js'
import { demoCode } from '../../defaults/demo-code.js'

export const LoadDemoDialog: FunctionComponent<DialogComponentProps & {
  editorPanelId: PanelId
}> = ({ open, onClose, editorPanelId }) => {
  const editorDispatch = useEditorDispatch()
  const layoutDispatch = useLayoutDispatch()

  const onConfirm = useCallback(() => {
    editorDispatch((state) => ({ ...state, code: demoCode }))
    layoutDispatch((layout) => activateTabOfType(layout, editorPanelId))
    onClose()
  }, [editorDispatch, layoutDispatch, editorPanelId, onClose])

  const title = 'Load demo project?'

  return (
    <ConfirmationDialog open={open} onConfirm={onConfirm} onCancel={onClose} title={title}>
      This will delete your current project. Continue?
    </ConfirmationDialog>
  )
}
