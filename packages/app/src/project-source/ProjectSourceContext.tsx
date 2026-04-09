import { useSafeContext } from '@editor'
import { createContext, useReducer, type Dispatch, type FunctionComponent, type PropsWithChildren, type SetStateAction } from 'react'
import { createProjectSourceState, type ProjectSourceState } from './model.js'

function projectSourceReducer (state: ProjectSourceState, action: SetStateAction<ProjectSourceState>): ProjectSourceState {
  return typeof action === 'function' ? action(state) : action
}

export type ProjectSourceDispatch = Dispatch<SetStateAction<ProjectSourceState>>

const ProjectSourceContext = createContext<ProjectSourceState | undefined>(undefined)
const ProjectSourceDispatchContext = createContext<ProjectSourceDispatch | undefined>(undefined)

export const ProjectSourceProvider: FunctionComponent<PropsWithChildren<{
  initialState?: ProjectSourceState
}>> = ({ children, initialState = createProjectSourceState() }) => {
  const [state, dispatch] = useReducer(projectSourceReducer, initialState)

  return (
    <ProjectSourceContext value={state}>
      <ProjectSourceDispatchContext value={dispatch}>
        {children}
      </ProjectSourceDispatchContext>
    </ProjectSourceContext>
  )
}

export function useProjectSource (): ProjectSourceState {
  return useSafeContext(ProjectSourceContext, 'ProjectSourceContext')
}

export function useProjectSourceDispatch (): ProjectSourceDispatch {
  return useSafeContext(ProjectSourceDispatchContext, 'ProjectSourceDispatchContext')
}
