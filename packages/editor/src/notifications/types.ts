import type { Brand, Numeric } from '@utility'
import type { ComponentType } from 'react'

export type NotificationId = Brand<string, 'editor.NotificationId'>

export interface NotificationComponentProps {
  /**
   * The number of identical notifications (excluding this one), if a 'kind' was provided when showing the
   * notification and there are duplicates; zero otherwise.
   */
  readonly duplicates: number

  readonly onClose: () => void
}

export interface NotificationOptions {
  /**
   * An optional identifier for the notification kind. If provided, multiple notifications with the same kind will
   * show only one instance, and the 'duplicates' property will indicate how many others there are.
   */
  readonly kind?: string

  readonly timeout?: Numeric<'s'>
}

type DisposeNotification = () => void

export interface NotificationService {
  readonly showNotification: <P extends NotificationComponentProps>(
    component: ComponentType<P>,
    props: Omit<P, 'duplicates' | 'onClose'>,
    options?: NotificationOptions
  ) => DisposeNotification

  readonly closeNotification: (id: NotificationId) => void
}
