import type { EditorLocation } from '@editor/editor.js'
import type { RangeError } from '@language/error.js'
import type { FunctionComponent, PropsWithChildren } from 'react'
import { pluralize } from '../utilities/strings.js'

export const Footer: FunctionComponent<{
  errors: readonly RangeError[]
  editorLocation?: EditorLocation
  onClickErrors?: () => void
  onClickLocation?: () => void
}> = ({ errors, editorLocation, onClickErrors, onClickLocation }) => {
  return (
    <footer className='flex h-6 px-2 gap-2 items-center text-sm bg-surface-200 text-content-200 border-t border-t-frame-100 select-none'>
      <FooterButton onClick={onClickErrors}>
        {errors.length === 0 ? 'No errors' : pluralize(errors.length, 'error')}
      </FooterButton>

      <div className='flex-1' />

      {editorLocation != null && (
        <FooterButton onClick={onClickLocation}>
          Ln {editorLocation.line}, Col {editorLocation.column}
        </FooterButton>
      )}
    </footer>
  )
}

const FooterButton: FunctionComponent<PropsWithChildren<{
  onClick?: () => void
}>> = ({ onClick, children }) => {
  return (
    <button
      type='button'
      className='px-2 h-full enabled:cursor-pointer enabled:hocus:bg-surface-300 enabled:hocus:text-content-300'
      onClick={onClick}
      disabled={onClick == null}
    >
      {children}
    </button>
  )
}
