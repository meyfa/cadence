import { randomId } from '@editor/utilities/id.js'
import { createContext, useCallback, useMemo, useState, type FunctionComponent, type PropsWithChildren } from 'react'
import { useSafeContext } from '../hooks/context.js'

type DialogComponent = FunctionComponent<any>

interface DialogEntry {
  readonly id: string
  readonly component: DialogComponent
  readonly props?: Record<string, unknown>
}

type DisposeDialog = () => void

export interface DialogService {
  readonly showDialog: (component: DialogComponent, props?: Record<string, unknown>) => DisposeDialog
  readonly closeDialog: (id: string) => void
}

export const DialogContext = createContext<DialogService | undefined>(undefined)

const DialogHost: FunctionComponent<{
  dialogs: readonly DialogEntry[]
  onClose: (id: string) => void
}> = ({ dialogs, onClose }) => {
  return (
    <>
      {dialogs.map((entry) => {
        const Component = entry.component
        return (
          <Component
            key={entry.id}
            {...entry.props}
            open={true}
            onClose={() => onClose(entry.id)}
          />
        )
      })}
    </>
  )
}

export const DialogProvider: FunctionComponent<PropsWithChildren> = ({ children }) => {
  const [dialogs, setDialogs] = useState<DialogEntry[]>([])

  const closeDialog = useCallback((id: string) => {
    setDialogs((dialogs) => dialogs.filter((item) => item.id !== id))
  }, [])

  const showDialog = useCallback((component: DialogComponent, props?: Record<string, unknown>) => {
    const id = randomId()
    setDialogs((d) => [...d, { id, component, props }])

    return () => closeDialog(id)
  }, [closeDialog])

  const value: DialogService = useMemo(() => ({
    showDialog,
    closeDialog
  }), [showDialog, closeDialog])

  return (
    <DialogContext value={value}>
      {children}
      <DialogHost dialogs={dialogs} onClose={closeDialog} />
    </DialogContext>
  )
}

export function useDialog (): DialogService {
  return useSafeContext(DialogContext, 'DialogContext')
}
