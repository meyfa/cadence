import type { DependencyList, FunctionComponent, PropsWithChildren } from 'react'
import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { useSafeContext } from '../../hooks/safe-context.ts'
import type { ServiceId } from '../types.ts'

type Unregister = () => void

interface ServiceContextValue {
  readonly services: ReadonlyMap<ServiceId, unknown>
  readonly registerService: (id: ServiceId, service: unknown) => Unregister
}

const ServiceContext = createContext<ServiceContextValue | undefined>(undefined)

export const ServiceProvider: FunctionComponent<PropsWithChildren> = ({ children }) => {
  const [services, setServices] = useState<ReadonlyMap<ServiceId, unknown>>(new Map())

  const registerService = useCallback((id: ServiceId, service: unknown): Unregister => {
    setServices((prev) => new Map(prev).set(id, service))

    return () => setServices((prev) => {
      const copy = new Map(prev)
      copy.delete(id)
      return copy
    })
  }, [])

  const value = useMemo(() => ({
    services,
    registerService
  }), [services, registerService])

  return (
    <ServiceContext value={value}>
      {children}
    </ServiceContext>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function useService<T> (id: ServiceId): T | undefined {
  const context = useSafeContext(ServiceContext, 'ServiceContext')
  return context.services.get(id) as T | undefined
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function useRegisterService<T> (id: ServiceId, service: T, deps: DependencyList = []): void {
  const { registerService } = useSafeContext(ServiceContext, 'ServiceContext')

  const instance = useMemo(() => service, deps)

  useEffect(() => registerService(id, instance), [id, instance, registerService])
}
