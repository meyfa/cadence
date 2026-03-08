import { type KeyboardShortcut, parseKeyboardShortcut } from '@editor/keyboard-shortcuts.js'
import { type FunctionComponent, Fragment } from 'react'

export const ShortcutKeys: FunctionComponent<{
  shortcut: KeyboardShortcut
}> = ({ shortcut }) => {
  const parts = parseKeyboardShortcut(shortcut)

  return (
    <div className='flex items-center gap-0.5 text-xs'>
      {parts.map((part, index) => (
        <Fragment key={part}>
          <span className='inline-block border border-frame-200 rounded p-0.5 leading-none bg-surface-200 text-content-100 font-mono'>
            {part}
          </span>
          {index < parts.length - 1 && (
            <span className='text-content-100'>+</span>
          )}
        </Fragment>
      ))}
    </div>
  )
}
