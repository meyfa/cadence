import type { EditorLocation } from '@editor/editor.js'
import type { RangeError } from '@language/error.js'
import type { FunctionComponent } from 'react'
import { pluralize } from '../../utilities/strings.js'
import { Footer } from '../Footer.js'

export const EditorFooter: FunctionComponent<{
  errors: readonly RangeError[]
  editorLocation?: EditorLocation
}> = ({ errors, editorLocation }) => {
  return (
    <Footer>
      <div className='grow'>
        {errors.length === 0 ? 'No errors' : pluralize(errors.length, 'error')}
      </div>

      {editorLocation != null && (
        <div>
          Ln {editorLocation.line}, Col {editorLocation.column}
        </div>
      )}
    </Footer>
  )
}
