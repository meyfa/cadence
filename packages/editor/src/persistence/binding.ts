import { numeric } from '@utility'
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useLatestRef } from '../hooks/latest-ref.js'
import { usePersistenceContext } from './components/PersistenceContext.js'
import type { PersistenceDomain, PersistenceEvent } from './types.js'

const STORAGE_DEBOUNCE = numeric('s', 0.25)

export interface UsePersistentBindingOptions {
  readonly onConflict?: PersistentStateConflictPolicy
}

export type PersistentStateConflictPolicy = 'manual' | 'accept-remote' | 'keep-local'

export interface PersistentBinding<T> {
  readonly meta: PersistentStateMeta<T>
  readonly controls: PersistentStateControls
}

export interface PersistentStateMeta<T> {
  readonly loaded: boolean
  readonly conflict?: PersistentStateConflict<T>
  readonly error?: Error
}

export interface PersistentStateConflict<T> {
  readonly kind: PersistenceEvent<T>['kind']
  readonly remoteValue?: T
}

export interface PersistentStateControls {
  readonly acceptRemote: () => void
  readonly keepLocal: () => void
}

export function usePersistentBinding<T> (
  domain: PersistenceDomain<T>,
  value: T,
  applyValue: (value: T) => void,
  options: UsePersistentBindingOptions = {}
): PersistentBinding<T> {
  const { engine } = usePersistenceContext()

  const areEqual = domain.areEqual ?? Object.is
  const { onConflict = 'manual' } = options

  const [persistedValue, setPersistedValueInternal] = useState<T>(domain.fallbackValue)
  const [meta, setMeta] = useState<PersistentStateMeta<T>>({ loaded: false })
  const [dirty, setDirty] = useState(false)

  const previousLocalValueRef = useRef(value)
  const previousPersistedValueRef = useRef(persistedValue)
  const previousLoadedRef = useRef(meta.loaded)
  const previousConflictRef = useRef(meta.conflict)

  const applyValueRef = useLatestRef(applyValue)
  const areEqualRef = useLatestRef(areEqual)

  const { loaded, conflict } = meta

  const setPersistedValue = useCallback((action: SetStateAction<T>) => {
    setDirty(true)
    setPersistedValueInternal(action)
  }, [])

  // Load and subscribe to changes
  useEffect(() => {
    let cancelled = false

    engine.load(domain)
      .then((loadedValue) => {
        if (!cancelled) {
          if (loadedValue != null) {
            setPersistedValueInternal(loadedValue)
          }

          setDirty(false)
          setMeta((prevMeta) => ({ ...prevMeta, loaded: true }))
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDirty(false)
          setMeta((prevMeta) => ({ ...prevMeta, loaded: true, error: castError(err) }))
        }
      })

    const unsubscribe = engine.subscribe(domain, (event) => {
      if (!cancelled) {
        applyConflictPolicy(event, domain.fallbackValue, onConflict, setPersistedValueInternal, setDirty, setMeta)
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [domain, engine, onConflict])

  // Save on changes with debounce
  useEffect(() => {
    if (!loaded || conflict != null || !dirty) {
      return
    }

    let cancelled = false

    const timeout = setTimeout(() => {
      engine.save(domain, persistedValue)
        .then(() => {
          if (!cancelled) {
            setDirty(false)
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setMeta((prevMeta) => ({ ...prevMeta, error: castError(err) }))
          }
        })
    }, STORAGE_DEBOUNCE.value * 1000)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [conflict, dirty, domain, engine, loaded, persistedValue])

  // Reconcile external changes
  useEffect(() => {
    const compare = areEqualRef.current

    const previousLocalValue = previousLocalValueRef.current
    const previousPersistedValue = previousPersistedValueRef.current
    const previousLoaded = previousLoadedRef.current
    const previousConflict = previousConflictRef.current

    const localChanged = !compare(value, previousLocalValue)
    const persistedChanged = !compare(persistedValue, previousPersistedValue)
    const valuesMatch = compare(value, persistedValue)

    const conflictCleared = previousConflict != null && meta.conflict == null

    if (meta.loaded && meta.conflict == null && !valuesMatch) {
      if (!previousLoaded || (persistedChanged && !localChanged)) {
        applyValueRef.current(persistedValue)
      } else if (!persistedChanged && (localChanged || conflictCleared)) {
        setPersistedValue(value)
      }
    }

    previousLocalValueRef.current = value
    previousPersistedValueRef.current = persistedValue
    previousLoadedRef.current = meta.loaded
    previousConflictRef.current = meta.conflict
  }, [meta.conflict, meta.loaded, persistedValue, setPersistedValue, value])

  // Controls for manual conflict resolution
  const controls: PersistentStateControls = useMemo(() => ({
    acceptRemote: () => {
      if (conflict != null) {
        setPersistedValueInternal(conflict.remoteValue ?? domain.fallbackValue)
        setDirty(false)
        setMeta((prevMeta) => ({ ...prevMeta, conflict: undefined }))
      }
    },

    keepLocal: () => {
      if (conflict != null) {
        setDirty(true)
        setMeta((prevMeta) => ({ ...prevMeta, conflict: undefined }))
      }
    }
  }), [domain, conflict])

  return { meta, controls }
}

function applyConflictPolicy<T> (
  event: PersistenceEvent<T>,
  fallbackValue: T,
  policy: PersistentStateConflictPolicy,
  setState: Dispatch<SetStateAction<T>>,
  setDirty: Dispatch<SetStateAction<boolean>>,
  setMeta: Dispatch<SetStateAction<PersistentStateMeta<T>>>
): void {
  const { kind } = event

  switch (policy) {
    case 'keep-local': {
      setDirty(true) // save over the remote
      setMeta((prev) => ({ ...prev, conflict: undefined }))
      return
    }

    case 'accept-remote': {
      setDirty(false)
      setState(kind === 'updated' ? event.value : fallbackValue)
      setMeta((prev) => ({ ...prev, conflict: undefined }))
      return
    }

    case 'manual': {
      const conflict = kind === 'updated' ? { kind, remoteValue: event.value } : { kind }
      setMeta((prev) => ({ ...prev, conflict }))
      return
    }
  }
}

function castError (err: unknown): Error {
  return err instanceof Error ? err : new Error('unknown error')
}
