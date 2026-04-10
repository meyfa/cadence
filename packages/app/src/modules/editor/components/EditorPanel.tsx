import { linter } from '@codemirror/lint'
import { Compartment } from '@codemirror/state'
import { Editor, type EditorLocation, type EditorViewDispatch, type PanelProps } from '@editor'
import { cadenceLanguageSupport, cadenceLinter } from '@language-support'
import { numeric } from '@utility'
import { useCallback, useLayoutEffect, useMemo, useRef, type FunctionComponent } from 'react'
import { getCspNonce } from '../../../csp.js'
import { useProjectSource, useProjectSourceDispatch } from '../../../project-source/ProjectSourceContext.js'
import { getProjectFileContent, setProjectFileContent } from '../../../project-source/model.js'
import { useEffectiveTheme } from '../../../theme.js'
import { getEditorPanelProps } from '../panel-props.js'
import { useEditorDispatch } from '../provider.js'
import { cadenceDarkTheme, cadenceLightTheme } from '../theme.js'

const indent = '  ' // 2 spaces
const lintDelay = numeric('s', 0.25)

export const EditorPanel: FunctionComponent<PanelProps> = ({ panelProps }) => {
  const { filePath } = getEditorPanelProps(panelProps)
  const editorDispatch = useEditorDispatch()
  const source = useProjectSource()
  const sourceDispatch = useProjectSourceDispatch()

  const theme = useEffectiveTheme()
  const code = getProjectFileContent(source, filePath) ?? ''

  const onChange = useCallback((code: string) => {
    sourceDispatch((state) => setProjectFileContent(state, filePath, code))
  }, [filePath, sourceDispatch])

  const onLocationChange = useCallback((caret: EditorLocation | undefined) => {
    editorDispatch((prev) => ({
      ...prev,
      carets: {
        ...prev.carets,
        [filePath]: caret
      }
    }))
  }, [editorDispatch, filePath])

  const viewDispatchRef = useRef<EditorViewDispatch | undefined>(undefined)

  const themeConfig = useMemo(() => new Compartment(), [])

  useLayoutEffect(() => {
    viewDispatchRef.current?.({
      effects: themeConfig.reconfigure(theme === 'dark' ? cadenceDarkTheme : cadenceLightTheme)
    })
  }, [themeConfig, theme])

  const extensions = useMemo(() => [
    cadenceLanguageSupport(),
    linter(cadenceLinter, { delay: lintDelay.value * 1000 }),
    themeConfig.of(cadenceDarkTheme)
  ], [themeConfig])

  return (
    <Editor
      document={code}
      indent={indent}
      extensions={extensions}
      cspNonce={getCspNonce()}
      className='relative h-full overflow-hidden'
      onChange={onChange}
      onLocationChange={onLocationChange}
      viewDispatchRef={viewDispatchRef}
    />
  )
}
