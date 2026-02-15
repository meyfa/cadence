import type { FunctionComponent, PropsWithChildren } from 'react'
import { Button } from '../Button.js'
import { BaseDialog } from './BaseDialog.js'

export const ConfirmationDialog: FunctionComponent<PropsWithChildren<{
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  confirmText?: string
  cancelText?: string
}>> = ({ open, onConfirm, onCancel, title, children, confirmText, cancelText }) => {
  return (
    <BaseDialog
      open={open}
      onClose={(value) => value ? onConfirm() : onCancel()}
      title={title}
      actions={(
        <>
          <Button onClick={() => onConfirm()}>
            {confirmText ?? 'Okay'}
          </Button>
          <Button onClick={() => onCancel()}>
            {cancelText ?? 'Cancel'}
          </Button>
        </>
      )}
    >
      {children}
    </BaseDialog>
  )
}
