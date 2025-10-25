import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import type { FunctionComponent, PropsWithChildren } from 'react'
import { Button } from '../Button.js'

export const ConfirmationDialog: FunctionComponent<PropsWithChildren<{
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  confirmText?: string
  cancelText?: string
}>> = ({ open, onConfirm, onCancel, title, children, confirmText, cancelText }) => {
  return (
    <Dialog open={open} onClose={(value) => value ? onConfirm() : onCancel()} className='relative z-50'>
      <DialogBackdrop className='fixed inset-0 bg-dialog-backdrop' />

      <div className='fixed inset-0 flex w-screen items-center justify-center p-4'>
        <DialogPanel className='max-w-lg p-8 flex flex-col gap-8 rounded bg-surface-100 border border-frame-100 shadow-lg'>
          <DialogTitle className='text-xl leading-none'>
            {title}
          </DialogTitle>

          <div>
            {children}
          </div>

          <div className='flex gap-4 justify-end'>
            <Button onClick={() => onConfirm()}>
              {confirmText ?? 'Okay'}
            </Button>
            <Button onClick={() => onCancel()}>
              {cancelText ?? 'Cancel'}
            </Button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
