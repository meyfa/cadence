import type { FunctionComponent, PropsWithChildren } from 'react'
import { createContext, useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { useSafeContext } from '../../hooks/safe-context.js'
import type { Problem } from '../types.js'
import { randomId } from '@utility'

type UndoInsert = () => void

interface ProblemContextValue {
  readonly problems: readonly Problem[]
  readonly insertProblems: (problems: readonly Problem[]) => UndoInsert
}

const ProblemContext = createContext<ProblemContextValue | undefined>(undefined)

export const ProblemProvider: FunctionComponent<PropsWithChildren> = ({ children }) => {
  const [problems, setProblems] = useState<ReadonlyMap<string, readonly Problem[]>>(new Map())

  const insertProblems = useCallback((problems: readonly Problem[]): UndoInsert => {
    const id = randomId()
    setProblems((prev) => new Map(prev).set(id, problems))

    return () => {
      setProblems((prev) => {
        const copy = new Map(prev)
        copy.delete(id)
        return copy
      })
    }
  }, [])

  const value = useMemo(() => ({
    problems: Array.from(problems.values()).flat(),
    insertProblems
  }), [problems, insertProblems])

  return (
    <ProblemContext value={value}>
      {children}
    </ProblemContext>
  )
}

export function useProblems (): readonly Problem[] {
  const { problems } = useSafeContext(ProblemContext, 'ProblemContext')
  return problems
}

export function useProvideProblems (problems: readonly Problem[]): void {
  const { insertProblems } = useSafeContext(ProblemContext, 'ProblemContext')

  useLayoutEffect(() => {
    return insertProblems(problems)
  }, [insertProblems, problems])
}
