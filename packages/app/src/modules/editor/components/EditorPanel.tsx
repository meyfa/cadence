import type { SourceRange } from '@meyfa/cadence-ast'
import { syntaxTree } from '@codemirror/language'
import type { Diagnostic } from '@codemirror/lint'
import type { EditorView, ViewUpdate } from '@codemirror/view'
import type { EditorLocation, PanelProps, Problem } from '@meyfa/cadence-editor'
import { Editor, getProjectFileContent, setProjectFileContent, useProjectSource, useProjectSourceDispatch, useProvideProblems } from '@meyfa/cadence-editor'
import type { RangeError } from '@meyfa/cadence-language'
import type { LanguageDiagnostic } from '@meyfa/cadence-language-support'
import { applySemanticOperation, cadenceLanguageSupport, findUnusedVariables, goToDefinitionExtension, highlightOccurrencesExtension, hoverInfoExtension } from '@meyfa/cadence-language-support'
import type { FunctionComponent } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useCompilationState } from '../../../compilation/CompilationContext.tsx'
import { getCspNonce } from '../../../csp.ts'
import { useEffectiveTheme } from '../../../theme.ts'
import { getEditorPanelProps } from '../panel-props.ts'
import { useEditorDispatch, useEditorRuntime } from '../provider.tsx'
import { cadenceDarkTheme, cadenceLightTheme } from '../theme.ts'

const indent = '  ' // 2 spaces
const extensions = [
  cadenceLanguageSupport(),
  highlightOccurrencesExtension(),
  goToDefinitionExtension(),
  hoverInfoExtension()
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
      ? applySemanticOperation(findUnusedVariables, syntaxTree(editorView.state), editorView.state.doc)
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
