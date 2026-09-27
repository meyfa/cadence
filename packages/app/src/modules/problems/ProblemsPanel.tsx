import { EditorSelection } from '@codemirror/state'
import type { PanelProps, Problem, ProblemKind, ProblemRange } from '@meyfa/cadence-editor'
import { activateTabOfType, useLayoutDispatch, useProblems } from '@meyfa/cadence-editor'
import { RangeError } from '@meyfa/cadence-language'
import { ErrorOutlineSharp, WarningAmberSharp } from '@mui/icons-material'
import type { SvgIconProps } from '@mui/material/SvgIcon'
import clsx from 'clsx'
import type { FunctionComponent, KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { useCallback, useMemo } from 'react'
import { TRACK_FILE_PATH } from '../../persistence/constants.ts'
import { editorPanelId } from '../editor/index.ts'
import type { EditorPanelProps } from '../editor/panel-props.ts'
import { useEditorRuntime } from '../editor/provider.tsx'

interface ProblemGroup {
  readonly filePath?: string
  readonly problems: readonly Problem[]
}

export const ProblemsPanel: FunctionComponent<PanelProps> = () => {
  const groups = useProblemsByFilePath()

  return (
    <div className='h-full overflow-auto p-2'>
      <div className={clsx('grow', groups.length > 0 ? 'text-content-300' : 'text-content-100')}>
        {groups.length === 0 && (
          <div className='text-content-100'>
            No problems found.
          </div>
        )}

        {groups.map((group, groupIndex) => (
          <div key={groupIndex}>
            {group.filePath != null && (
              <ProblemsPanelHeader filePath={group.filePath} />
            )}

            {group.problems.map((problem, index) => (
              <ProblemsPanelRow key={index} problem={problem} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

const ProblemsPanelHeader: FunctionComponent<{
  filePath: string
}> = ({ filePath }) => {
  return (
    <div className='text-content-100 font-semibold mt-2 first:mt-0'>
      {filePath}
    </div>
  )
}

const ProblemsPanelRow: FunctionComponent<{
  problem: Problem
}> = ({ problem }) => {
  const { kind, label, message, range, error } = problem
  const problemRange = range ?? (error instanceof RangeError ? error.range : undefined)

  const layoutDispatch = useLayoutDispatch()
  const editorRuntime = useEditorRuntime()

  const goToProblem = useCallback((range: ProblemRange) => {
    layoutDispatch((layout) => activateTabOfType(layout, editorPanelId, () => ({
      type: editorPanelId,
      props: {
        filePath: problemRange?.filePath ?? TRACK_FILE_PATH
      } satisfies EditorPanelProps
    })))

    const view = editorRuntime.viewRef.current
    if (view == null) {
      return
    }

    const selection = EditorSelection.single(range.offset)
    view.dispatch({ selection, scrollIntoView: true })
    view.focus()
  }, [layoutDispatch, editorRuntime])

  const clickable = problemRange != null

  const onClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    // Ensure text selection still works.
    const selectionLength = window.getSelection()?.toString().length ?? 0
    if (problemRange == null || selectionLength > 0) {
      return
    }

    event.preventDefault()
    goToProblem(problemRange)
  }, [problemRange, goToProblem])

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (problemRange == null || !['Enter', ' '].includes(event.key)) {
      return
    }

    event.preventDefault()
    goToProblem(problemRange)
  }, [clickable, goToProblem])

  return (
    <div
      className={clsx('px-2 rounded-sm', clickable && 'cursor-pointer hocus:bg-surface-200')}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <span className='text-content-100 mr-1'>
        {renderIconForProblemKind(kind)}
      </span>
      <span className='text-content-100'>
        {`${label}: `}
      </span>
      {message}
      {problemRange != null && (
        <span className='text-content-100 text-sm'>
          {` (Ln ${problemRange.line}, Col ${problemRange.column})`}
        </span>
      )}
    </div>
  )
}

function useProblemsByFilePath (): readonly ProblemGroup[] {
  const problems = useProblems()

  return useMemo(() => {
    const groups: ProblemGroup[] = []
    const groupsByFilePath = new Map<string, Problem[]>()

    for (const problem of problems) {
      const range = problem.range ?? (problem.error instanceof RangeError ? problem.error.range : undefined)
      const filePath = range?.filePath

      if (filePath == null) {
        groups.push({ problems: [problem] })
        continue
      }

      let groupProblems = groupsByFilePath.get(filePath)
      if (groupProblems == null) {
        groupProblems = []
        groupsByFilePath.set(filePath, groupProblems)
        groups.push({ filePath, problems: groupProblems })
      }

      groupProblems.push(problem)
    }

    return groups
  }, [problems])
}

function renderIconForProblemKind (kind: ProblemKind): ReactNode {
  const fontSize: SvgIconProps['fontSize'] = 'small'

  switch (kind) {
    case 'error':
      return <ErrorOutlineSharp fontSize={fontSize} />
    case 'warning':
      return <WarningAmberSharp fontSize={fontSize} />
    default:
      kind satisfies never
  }
}
