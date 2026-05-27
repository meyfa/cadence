import type { ProblemKind } from '@editor'
import { useProblems } from '@editor'
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
