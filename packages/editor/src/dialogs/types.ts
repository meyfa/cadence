import type { Brand } from '@utility'
import type { ComponentType } from 'react'

export type DialogId = Brand<string, 'editor.DialogId'>

export interface DialogComponentProps {
  readonly open: boolean
  readonly onClose: () => void
}

type DisposeDialog = () => void

export interface DialogService {
  readonly showDialog: <P extends DialogComponentProps>(
    component: ComponentType<P>,
    props: Omit<P, 'open' | 'onClose'>
  ) => DisposeDialog

  readonly closeDialog: (id: DialogId) => void
}
