import type { SourceRange } from '@ast'
import type { Diagnostic } from '@codemirror/lint'
import type { EditorView } from '@codemirror/view'
import type { EditorLocation, PanelProps } from '@editor'
import { Editor, getProjectFileContent, setProjectFileContent, useProjectSource, useProjectSourceDispatch } from '@editor'
import { cadenceLanguageSupport, goToDefinitionExtension } from '@language-support'
import type { FunctionComponent } from 'react'
import { useCallback, useMemo } from 'react'
import { useCompilationState } from '../../../compilation/CompilationContext.js'
import { getCspNonce } from '../../../csp.js'
import { useEffectiveTheme } from '../../../theme.js'
import { getEditorPanelProps } from '../panel-props.js'
import { useEditorDispatch, useEditorRuntime } from '../provider.js'
import { cadenceDarkTheme, cadenceLightTheme } from '../theme.js'

const indent = '  ' // 2 spaces
const extensions = [
  cadenceLanguageSupport(),
  goToDefinitionExtension()
]

function convertError (message: string, range: SourceRange | undefined): Diagnostic {
  return {
    from: range?.offset ?? 0,
    to: (range?.offset ?? 0) + (range?.length ?? 0),
    severity: 'error',
    message
  }
}

export const EditorPanel: FunctionComponent<PanelProps> = ({ panelProps, tabId }) => {
  const { filePath } = getEditorPanelProps(panelProps)
  const source = useProjectSource()
  const sourceDispatch = useProjectSourceDispatch()

  const code = getProjectFileContent(source, filePath) ?? ''

  const onChange = useCallback((code: string) => {
    sourceDispatch((state) => setProjectFileContent(state, filePath, code))
  }, [filePath, sourceDispatch])

  const editorDispatch = useEditorDispatch()
  const editorRuntime = useEditorRuntime()

  const onEditorViewChange = useCallback((view: EditorView | undefined) => {
    editorRuntime.viewRef.current = view
  }, [editorRuntime])

  const onLocationChange = useCallback((caret: EditorLocation | undefined) => {
    editorDispatch((prev) => ({ ...prev, carets: { ...prev.carets, [tabId]: caret } }))
  }, [editorDispatch, tabId])

  const effectiveTheme = useEffectiveTheme()
  const theme = effectiveTheme === 'dark' ? cadenceDarkTheme : cadenceLightTheme

  const { result: { errors } } = useCompilationState()
  const diagnostics = useMemo(() => {
    return errors
      .filter((error) => error.range?.filePath === filePath)
      .map((error) => convertError(error.message, error.range))
  }, [errors, filePath])

  return (
    <Editor
      document={code}
      indent={indent}
      theme={theme}
      extensions={extensions}
      diagnostics={diagnostics}
      cspNonce={getCspNonce()}
      className='relative h-full overflow-hidden'
      onChange={onChange}
      onEditorViewChange={onEditorViewChange}
      onLocationChange={onLocationChange}
    />
  )
}
