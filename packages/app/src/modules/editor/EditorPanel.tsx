import { linter } from '@codemirror/lint'
import { Editor, type EditorLocation, type PanelProps } from '@editor'
import { cadenceLanguageSupport, cadenceLinter } from '@language-support'
import { numeric } from '@utility'
import { useCallback, type FunctionComponent } from 'react'
import { useEditor, useEditorDispatch } from '../../components/contexts/EditorContext.js'
import { getCspNonce } from '../../csp.js'
import { useEffectiveTheme } from '../../theme.js'

const indent = '  ' // 2 spaces
const lintDelay = numeric('s', 0.25)

const extensions = [
  cadenceLanguageSupport(),
  linter(cadenceLinter, { delay: lintDelay.value * 1000 })
]

export const EditorPanel: FunctionComponent<PanelProps> = () => {
  const editor = useEditor()
  const editorDispatch = useEditorDispatch()

  const theme = useEffectiveTheme()

  const onChange = useCallback((code: string) => {
    editorDispatch((prev) => ({ ...prev, code }))
  }, [editorDispatch])

  const onLocationChange = useCallback((caret: EditorLocation | undefined) => {
    editorDispatch((prev) => ({ ...prev, caret }))
  }, [editorDispatch])

  return (
    <Editor
      document={editor.code}
      indent={indent}
      theme={theme}
      extensions={extensions}
      cspNonce={getCspNonce()}
      className='relative h-full overflow-hidden'
      onChange={onChange}
      onLocationChange={onLocationChange}
    />
  )
}
