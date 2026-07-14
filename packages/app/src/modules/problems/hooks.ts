import type { ProblemKind } from '@meyfa/cadence-editor'
import { useProblems } from '@meyfa/cadence-editor'
import { useMemo } from 'react'

export function useProblemCountByKind (): Record<ProblemKind, number> {
  const problems = useProblems()

  return useMemo(() => {
    return problems.reduce<Record<ProblemKind, number>>((accumulator, problem) => {
      ++accumulator[problem.kind]
      return accumulator
    }, { error: 0, warning: 0 } satisfies Record<ProblemKind, number>)
  }, [problems])
}
