import type { EditorLocation } from '@editor/editor.js'
import { useCallback, type FunctionComponent } from 'react'
import { Editor } from '../components/editor/Editor.js'
import { useEditor } from '../state/EditorContext.js'

export const EditorPane: FunctionComponent = () => {
  const [editor, dispatch] = useEditor()

  const onChange = useCallback((newCode: string) => {
    dispatch((prev) => ({
      ...prev,
      code: newCode
    }))
  }, [dispatch])

  const onLocationChange = useCallback((location: EditorLocation | undefined) => {
    dispatch((prev) => ({
      ...prev,
      caret: location
    }))
  }, [dispatch])

  return (
    <Editor
      document={editor.code}
      onChange={onChange}
      onLocationChange={onLocationChange}
      className='h-full'
    />
  )
}
