import type { FunctionComponent, PropsWithChildren } from 'react'
import { createContext, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useSafeContext } from '../../hooks/safe-context.js'
import type { ModuleId } from '../../modules/types.js'
import type { Problem, ProblemInput } from '../types.js'

interface ProblemContextValue {
  readonly problems: readonly Problem[]
  readonly setSourceProblems: (sourceId: ModuleId, problems: readonly Problem[]) => void
  readonly clearSourceProblems: (sourceId: ModuleId) => void
}

const ProblemContext = createContext<ProblemContextValue | undefined>(undefined)

export const ProblemProvider: FunctionComponent<PropsWithChildren> = ({ children }) => {
  const [sources, setSources] = useState<ReadonlyMap<ModuleId, readonly Problem[]>>(new Map())

  const setSourceProblems = useCallback((sourceId: ModuleId, problems: readonly Problem[]) => {
    setSources((sources) => new Map(sources).set(sourceId, problems))
  }, [])

  const clearSourceProblems = useCallback((sourceId: ModuleId) => {
    setSources((sources) => {
      const copy = new Map(sources)
      copy.delete(sourceId)
      return copy
    })
  }, [])

  const value = useMemo(() => ({
    problems: Array.from(sources.values()).flat(),
    setSourceProblems,
    clearSourceProblems
  }), [sources, setSourceProblems, clearSourceProblems])

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

export function useProvideProblems (moduleId: ModuleId, sourceProblems: readonly ProblemInput[]): void {
  const { setSourceProblems, clearSourceProblems } = useSafeContext(ProblemContext, 'ProblemContext')

  const problems = useMemo(() => {
    return sourceProblems.map((entry): Problem => ({ moduleId, ...entry }))
  }, [moduleId, sourceProblems])

  // update problems when errors change
  useLayoutEffect(() => {
    setSourceProblems(moduleId, problems)
  }, [moduleId, problems, setSourceProblems])

  // clear problems on unmount
  useEffect(() => {
    return () => clearSourceProblems(moduleId)
  }, [moduleId, clearSourceProblems])
}
