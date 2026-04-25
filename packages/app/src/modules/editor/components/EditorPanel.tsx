import { syntaxTree } from '@codemirror/language'
import type { Diagnostic } from '@codemirror/lint'
import type { EditorView, ViewUpdate } from '@codemirror/view'
import type { EditorLocation, PanelProps, Problem } from '@editor'
import { Editor, getProjectFileContent, setProjectFileContent, useProjectSource, useProjectSourceDispatch, useProvideProblems } from '@editor'
import type { RangeError } from '@language'
import type { LanguageDiagnostic, SourceRange } from '@language-support'
import { cadenceLanguageSupport, findUnusedVariablesInTree, goToDefinitionExtension } from '@language-support'
import type { FunctionComponent } from 'react'
import { useCallback, useMemo, useState } from 'react'
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

function getCompilerDiagnostics (filePath: string, errors: readonly RangeError[]): readonly Diagnostic[] {
  return errors
    .filter((error) => error.range?.filePath === filePath)
    .map((error) => toDiagnostic('error', error.message, error.range))
}

function getLanguageDiagnostics (diagnostics: readonly LanguageDiagnostic[]): readonly Diagnostic[] {
  return diagnostics.map((item) => toDiagnostic('warning', item.message, item.range))
}

function toDiagnostic (severity: 'error' | 'warning', message: string, range: SourceRange | undefined): Diagnostic {
  return {
    from: range?.offset ?? 0,
    to: (range?.offset ?? 0) + (range?.length ?? 0),
    severity,
    message
  }
}

export const EditorPanel: FunctionComponent<PanelProps> = ({ panelProps, tabId }) => {
  const { filePath } = getEditorPanelProps(panelProps)
  const source = useProjectSource()
  const sourceDispatch = useProjectSourceDispatch()
  const [analysisRevision, setAnalysisRevision] = useState(0)
  const [editorView, setEditorView] = useState<EditorView>()

  const code = getProjectFileContent(source, filePath) ?? ''

  const onChange = useCallback((code: string) => {
    sourceDispatch((state) => setProjectFileContent(state, filePath, code))
  }, [filePath, sourceDispatch])

  const editorDispatch = useEditorDispatch()
  const editorRuntime = useEditorRuntime()

  const onEditorViewChange = useCallback((view: EditorView | undefined) => {
    editorRuntime.viewRef.current = view
    setEditorView(view)
  }, [editorRuntime])

  const onEditorViewUpdate = useCallback((update: ViewUpdate) => {
    if (syntaxTree(update.startState) !== syntaxTree(update.state)) {
      setAnalysisRevision((value) => value + 1)
    }
  }, [])

  const onLocationChange = useCallback((caret: EditorLocation | undefined) => {
    editorDispatch((prev) => ({ ...prev, carets: { ...prev.carets, [tabId]: caret } }))
  }, [editorDispatch, tabId])

  const effectiveTheme = useEffectiveTheme()
  const theme = effectiveTheme === 'dark' ? cadenceDarkTheme : cadenceLightTheme

  const unusedVariables = useMemo(() => {
    return editorView != null
      ? findUnusedVariablesInTree(syntaxTree(editorView.state), editorView.state.doc)
      : []
  }, [analysisRevision, editorView])

  const { result: { errors } } = useCompilationState()
  const diagnostics = useMemo(() => {
    return [
      ...getCompilerDiagnostics(filePath, errors),
      ...getLanguageDiagnostics(unusedVariables)
    ]
  }, [errors, filePath, unusedVariables])

  const problems = useMemo(() => {
    return unusedVariables.map((diagnostic): Problem => ({
      kind: 'warning',
      label: 'Analysis',
      message: diagnostic.message,
      range: {
        ...diagnostic.range,
        filePath
      }
    }))
  }, [unusedVariables, filePath])

  useProvideProblems(problems)

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
      onEditorViewUpdate={onEditorViewUpdate}
      onLocationChange={onLocationChange}
    />
  )
}
