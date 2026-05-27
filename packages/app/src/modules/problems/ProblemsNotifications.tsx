import clsx from 'clsx'
import { useProblemCountByKind } from './hooks.js'

export const ProblemsNotifications = () => {
  const { error, warning } = useProblemCountByKind()
  const count = error + warning

  if (count === 0) {
    return null
  }

  return (
    <span
      className={clsx(
        'px-1 py-0.5 text-xs leading-none border rounded',
        error === 0
          ? 'bg-warning-surface text-warning-content border-warning-frame'
          : 'bg-error-surface text-error-content border-error-frame'
      )}
    >
      {count}
    </span>
  )
}
