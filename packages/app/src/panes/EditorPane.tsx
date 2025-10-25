import type { EditorLocation } from '@editor/editor.js'
import { type FunctionComponent } from 'react'
import { Editor } from '../components/editor/Editor.js'

export const EditorPage: FunctionComponent<{
  value: string
  onChange: (value: string) => void
  onLocationChange?: (location: EditorLocation | undefined) => void
}> = ({ value, onChange, onLocationChange }) => {
  return (
    <Editor
      document={value}
      onChange={onChange}
      onLocationChange={onLocationChange}
      className='h-full'
    />
  )
}
