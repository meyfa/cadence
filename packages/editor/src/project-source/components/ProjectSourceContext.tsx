import type { Dispatch, FunctionComponent, PropsWithChildren, SetStateAction } from 'react'
import { createContext, useReducer } from 'react'
import { useSafeContext } from '../../hooks/safe-context.ts'
import type { ProjectSource } from '../model.ts'
import { createProjectSourceState } from '../model.ts'

const initialState = createProjectSourceState()

function projectSourceReducer (state: ProjectSource, action: SetStateAction<ProjectSource>): ProjectSource {
  return typeof action === 'function' ? action(state) : action
}

export type ProjectSourceDispatch = Dispatch<SetStateAction<ProjectSource>>

const ProjectSourceContext = createContext<ProjectSource | undefined>(undefined)
const ProjectSourceDispatchContext = createContext<ProjectSourceDispatch | undefined>(undefined)

export const ProjectSourceProvider: FunctionComponent<PropsWithChildren> = ({ children }) => {
  const [state, dispatch] = useReducer(projectSourceReducer, initialState)

  return (
    <ProjectSourceContext value={state}>
      <ProjectSourceDispatchContext value={dispatch}>
        {children}
      </ProjectSourceDispatchContext>
    </ProjectSourceContext>
  )
}

export function useProjectSource (): ProjectSource {
  return useSafeContext(ProjectSourceContext, 'ProjectSourceContext')
}

export function useProjectSourceDispatch (): ProjectSourceDispatch {
  return useSafeContext(ProjectSourceDispatchContext, 'ProjectSourceDispatchContext')
}
