import { randomId } from '@utility'
import { createContext, useCallback, useMemo, useState, type ComponentType, type FunctionComponent, type PropsWithChildren } from 'react'
import { useSafeContext } from '../../hooks/safe-context.js'
import type { DialogComponentProps, DialogId, DialogService } from '../types.js'

interface DialogEntry<P extends DialogComponentProps = DialogComponentProps> {
  readonly id: DialogId
  readonly component: ComponentType<P>
  readonly props: P
}

interface DialogServiceInternal extends DialogService {
  readonly dialogs: readonly DialogEntry[]
}

const DialogContext = createContext<DialogServiceInternal | undefined>(undefined)

export const DialogProvider: FunctionComponent<PropsWithChildren> = ({ children }) => {
  const [entries, setEntries] = useState<readonly DialogEntry[]>([])

  const closeDialog = useCallback((id: DialogId) => {
    setEntries((entries) => entries.filter((item) => item.id !== id))
  }, [])

  const showDialog = useCallback(<P extends DialogComponentProps>(
    component: ComponentType<P>,
    props: Omit<P, 'open' | 'onClose'>
  ) => {
    const id = randomId() as DialogId
    setEntries((d) => [...d, { id, component, props }] as DialogEntry[])
    return () => closeDialog(id)
  }, [closeDialog])

  const value = useMemo(() => ({
    dialogs: entries,
    showDialog,
    closeDialog
  }), [entries, showDialog, closeDialog])

  return (
    <DialogContext value={value}>
      {children}
    </DialogContext>
  )
}

export const DialogHost: FunctionComponent = () => {
  // use internal context
  const { dialogs, closeDialog } = useSafeContext(DialogContext, 'DialogContext')

  return dialogs.map(({ id, component: Component, props }) => (
    <Component key={id} {...props} open onClose={() => closeDialog(id)} />
  ))
}

export function useDialogService (): DialogService {
  return useSafeContext(DialogContext, 'DialogContext')
}
