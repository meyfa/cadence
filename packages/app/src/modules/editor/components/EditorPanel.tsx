import { linter } from '@codemirror/lint'
import { Editor, type EditorLocation, type PanelProps } from '@editor'
import { cadenceLanguageSupport, cadenceLinter } from '@language-support'
import { numeric } from '@utility'
import { useCallback, type FunctionComponent } from 'react'
import { getCspNonce } from '../../../csp.js'
import { useProjectSource, useProjectSourceDispatch } from '../../../project-source/ProjectSourceContext.js'
import { getProjectFileContent, setProjectFileContent } from '../../../project-source/model.js'
import { useEffectiveTheme } from '../../../theme.js'
import { getEditorPanelProps } from '../panel-props.js'
import { useEditorDispatch } from '../provider.js'
import { cadenceDarkTheme, cadenceLightTheme } from '../theme.js'

const indent = '  ' // 2 spaces
const lintDelay = numeric('s', 0.25)

const extensions = [
  cadenceLanguageSupport(),
  linter(cadenceLinter, { delay: lintDelay.value * 1000 })
]

export const EditorPanel: FunctionComponent<PanelProps> = ({ panelProps, tabId }) => {
  const { filePath } = getEditorPanelProps(panelProps)
  const editorDispatch = useEditorDispatch()
  const source = useProjectSource()
  const sourceDispatch = useProjectSourceDispatch()

  const code = getProjectFileContent(source, filePath) ?? ''

  const onChange = useCallback((code: string) => {
    sourceDispatch((state) => setProjectFileContent(state, filePath, code))
  }, [filePath, sourceDispatch])

  const onLocationChange = useCallback((caret: EditorLocation | undefined) => {
    editorDispatch((prev) => ({
      ...prev,
      carets: {
        ...prev.carets,
        [tabId]: caret
      }
    }))
  }, [editorDispatch, tabId])

  const effectiveTheme = useEffectiveTheme()
  const theme = effectiveTheme === 'dark' ? cadenceDarkTheme : cadenceLightTheme

  return (
    <Editor
      document={code}
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
