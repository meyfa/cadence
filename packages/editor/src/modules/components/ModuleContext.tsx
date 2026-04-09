import { createContext, Fragment, type FunctionComponent, type PropsWithChildren, type ReactNode } from 'react'
import { useSafeContext } from '../../hooks/safe-context.js'
import type { Module } from '../types.js'

const ModuleContext = createContext<readonly Module[] | undefined>([])

export const ModuleProvider: FunctionComponent<PropsWithChildren<{
  modules: readonly Module[]
}>> = ({ modules, children }) => {
  return (
    <ModuleContext value={modules}>
      <ModuleStateHost modules={modules}>
        {children}
      </ModuleStateHost>
    </ModuleContext>
  )
}

const ModuleStateHost: FunctionComponent<PropsWithChildren<{
  modules: readonly Module[]
}>> = ({ modules, children }) => {
  // Nest providers of all modules.
  return modules.reduceRight<ReactNode>((content, { Provider, id }) => {
    if (Provider == null) {
      return content
    }

    return (
      <Provider key={id}>
        {content}
      </Provider>
    )
  }, children)
}

export const ModuleHost: FunctionComponent = () => {
  const modules = useModules()

  return modules.map(({ GlobalHooks, id }) => (
    <Fragment key={id}>
      {GlobalHooks != null && <GlobalHooks />}
    </Fragment>
  ))
}

export function useModules (): readonly Module[] {
  return useSafeContext(ModuleContext, 'ModuleContext')
}
