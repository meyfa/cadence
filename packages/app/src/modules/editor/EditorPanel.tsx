import { linter } from '@codemirror/lint'
import { Editor, type EditorLocation } from '@editor'
import { cadenceLanguageSupport, cadenceLinter } from '@language-support'
import { numeric } from '@utility'
import { useCallback, type FunctionComponent } from 'react'
import { useEditor } from '../../state/EditorContext.js'
import { useEffectiveTheme } from '../../theme.js'
import type { AppModulePanelProps } from '../types.js'

const indent = '  ' // 2 spaces
const lintDelay = numeric('s', 0.25)

const extensions = [
  cadenceLanguageSupport(),
  linter(cadenceLinter, { delay: lintDelay.value * 1000 })
]

export const EditorPanel: FunctionComponent<AppModulePanelProps> = () => {
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
