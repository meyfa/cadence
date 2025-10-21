import type { EditorLocation } from '@editor/editor.js'
import type { RangeError } from '@language/error.js'
import { useState, type FunctionComponent } from 'react'
import { Editor } from '../components/editor/Editor.js'
import { EditorFooter } from '../components/editor/EditorFooter.js'

export const EditorPage: FunctionComponent<{
  value: string
  onChange: (value: string) => void
  errors: readonly RangeError[]
}> = ({ value, onChange, errors }) => {
  const [editorLocation, setEditorLocation] = useState<EditorLocation | undefined>()

  return (
    <div className='h-full flex flex-col'>
      <Editor
        className='flex-1 min-h-0'
        document={value}
        onChange={onChange}
        onLocationChange={setEditorLocation}
      />

      <EditorFooter errors={errors} editorLocation={editorLocation} />
    </div>
  )
}
