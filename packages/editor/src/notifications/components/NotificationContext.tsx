import { randomId } from '@utility'
import { createContext, useCallback, useMemo, useState, type ComponentType, type FunctionComponent, type PropsWithChildren } from 'react'
import { useSafeContext } from '../../hooks/safe-context.js'
import type { NotificationComponentProps, NotificationId, NotificationOptions, NotificationService } from '../types.js'
import { createPortal } from 'react-dom'

interface NotificationEntry<P extends NotificationComponentProps = NotificationComponentProps> {
  readonly id: NotificationId
  readonly kind?: string
  readonly component: ComponentType<P>
  readonly props: Omit<P, 'duplicates' | 'onClose'>
}

interface NotificationServiceInternal extends NotificationService {
  readonly notifications: readonly NotificationEntry[]
}

const NotificationContext = createContext<NotificationServiceInternal | undefined>(undefined)

export const NotificationProvider: FunctionComponent<PropsWithChildren> = ({ children }) => {
  const [entries, setEntries] = useState<readonly NotificationEntry[]>([])

  const closeNotification = useCallback((id: NotificationId) => {
    setEntries((entries) => entries.filter((item) => item.id !== id))
  }, [])

  const showNotification = useCallback(<P extends NotificationComponentProps>(
    component: ComponentType<P>,
    props: Omit<P, 'duplicates' | 'onClose'>,
    options?: NotificationOptions
  ) => {
    const id = randomId() as NotificationId
    const kind = options?.kind

    setEntries((entries) => [{ id, kind, component, props }, ...entries] as NotificationEntry[])

    const timeoutHandle = options?.timeout != null
      ? setTimeout(() => closeNotification(id), options.timeout.value * 1000)
      : undefined

    return () => {
      if (timeoutHandle != null) {
        clearTimeout(timeoutHandle)
      }

      closeNotification(id)
    }
  }, [closeNotification])

  const value = useMemo(() => ({
    notifications: entries,
    showNotification,
    closeNotification
  }), [entries, showNotification, closeNotification])

  return (
    <NotificationContext value={value}>
      {children}
    </NotificationContext>
  )
}

export const NotificationHost: FunctionComponent = () => {
  // use internal context
  const { notifications, closeNotification } = useSafeContext(NotificationContext, 'NotificationContext')

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const notification of notifications) {
      if (notification.kind != null) {
        map.set(notification.kind, (map.get(notification.kind) ?? 0) + 1)
      }
    }
    return map
  }, [notifications])

  const unique = useMemo(() => {
    const seen = new Set<string>()
    return notifications.filter((notification) => {
      if (notification.kind == null) {
        return true
      }
      if (seen.has(notification.kind)) {
        return false
      }
      seen.add(notification.kind)
      return true
    })
  }, [notifications])

  return createPortal(
    <div style={{ position: 'fixed', top: 0, right: 0, zIndex: 100 }}>
      {unique.map(({ id, kind, component: Component, props }) => (
        <Component
          key={id}
          {...props}
          duplicates={kind != null ? (counts.get(kind) ?? 1) - 1 : 0}
          onClose={() => closeNotification(id)}
        />
      ))}
    </div>,
    document.body)
}

export function useNotificationService (): NotificationService {
  return useSafeContext(NotificationContext, 'NotificationContext')
}
