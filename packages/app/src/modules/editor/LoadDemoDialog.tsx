import { activateTabOfType, useLayout, type DialogComponentProps, type PanelId } from '@editor'
import { useCallback, type FunctionComponent } from 'react'
import { ConfirmationDialog } from '../../components/dialog/ConfirmationDialog.js'
import { demoCode } from '../../defaults/demo-code.js'
import { useEditor } from '../../state/EditorContext.js'

export const LoadDemoDialog: FunctionComponent<DialogComponentProps & {
  editorPanelId: PanelId
}> = ({ open, onClose, editorPanelId }) => {
  const [, editorDispatch] = useEditor()
  const [, layoutDispatch] = useLayout()

  const onConfirm = useCallback(() => {
    editorDispatch((state) => ({ ...state, code: demoCode }))
    activateTabOfType(layoutDispatch, editorPanelId)
    onClose()
  }, [editorDispatch, layoutDispatch, editorPanelId, onClose])

  const title = 'Load demo project?'

  return (
    <ConfirmationDialog open={open} onConfirm={onConfirm} onCancel={onClose} title={title}>
      This will delete your current project. Continue?
    </ConfirmationDialog>
  )
}
