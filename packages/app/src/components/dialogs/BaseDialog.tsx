import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import type { FunctionComponent, PropsWithChildren, ReactNode } from 'react'

export const BaseDialog: FunctionComponent<PropsWithChildren<{
  open: boolean
  onClose: (value: boolean) => void
  title: string
  actions?: ReactNode
}>> = ({ open, onClose, title, children, actions }) => {
  return (
    <Dialog open={open} onClose={onClose} className='relative z-50'>
      <DialogBackdrop className='fixed inset-0 bg-dialog-backdrop' />

      <div className='fixed inset-0 w-screen p-4 overflow-y-auto'>
        <div className='min-h-full flex items-center justify-center'>
          <DialogPanel className='min-w-2xs sm:min-w-sm max-w-lg rounded-md bg-surface-100 border border-frame-100 shadow-lg overflow-clip'>
            <DialogTitle className='text-lg leading-none p-4 bg-surface-200 border-b border-frame-100'>
              {title}
            </DialogTitle>

            <div className='p-4'>
              {children}
            </div>

            {actions != null && (
              <div className='flex gap-2 justify-end p-4'>
                {actions}
              </div>
            )}
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  )
}
