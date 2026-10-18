import type { Brand } from '@meyfa/cadence-utility'
import type { ComponentType } from 'react'

export type DialogId = Brand<string, 'editor.DialogId'>

export interface DialogComponentProps {
  readonly open: boolean
  readonly onClose: () => void
}

export type ShowDialog = <P extends DialogComponentProps>(
  component: ComponentType<P>,
  props: Omit<P, 'open' | 'onClose'>
) => DisposeDialog

export type CloseDialog = (id: DialogId) => void

type DisposeDialog = () => void

export interface DialogService {
  readonly showDialog: ShowDialog
  readonly closeDialog: CloseDialog
}
