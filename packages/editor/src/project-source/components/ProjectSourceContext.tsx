import { createContext, useReducer, type Dispatch, type FunctionComponent, type PropsWithChildren, type SetStateAction } from 'react'
import { useSafeContext } from '../../hooks/safe-context.js'
import { createProjectSourceState, type ProjectSource } from '../model.js'

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
