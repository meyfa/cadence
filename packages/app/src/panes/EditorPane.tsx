import { linter } from '@codemirror/lint'
import { Editor, type EditorLocation } from '@editor'
import { cadenceLanguageSupport, cadenceLinter } from '@language-support'
import { useCallback, type FunctionComponent } from 'react'
import { useEditor } from '../state/EditorContext.js'
import { useEffectiveTheme } from '../theme.js'

const indent = '  ' // 2 spaces
const lintDelayMillis = 250

const extensions = [
  cadenceLanguageSupport(),
  linter(cadenceLinter, { delay: lintDelayMillis })
]

export const EditorPane: FunctionComponent = () => {
  const [editorState, dispatch] = useEditor()
  const theme = useEffectiveTheme()

  const onChange = useCallback((code: string) => {
    dispatch((prev) => ({ ...prev, code }))
  }, [dispatch])

  const onLocationChange = useCallback((caret: EditorLocation | undefined) => {
    dispatch((prev) => ({ ...prev, caret }))
  }, [dispatch])

  return (
    <Editor
      document={editorState.code}
      indent={indent}
      theme={theme}
      extensions={extensions}
      className='relative h-full overflow-hidden'
      onChange={onChange}
      onLocationChange={onLocationChange}
    />
  )
}
