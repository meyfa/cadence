import type { PersistenceDomain } from '@editor'
import { usePersistentBinding } from '@editor'
import { numeric, type Numeric } from '@utility'
import { type, type Struct } from 'superstruct'
import { useAudioEngine } from '../../components/contexts/AudioEngineContext.js'
import { useObservable } from '../../hooks/observable.js'
import { validateNumeric } from '../../utilities/validation.js'

export const defaultOutputGain = numeric('db', -12)

interface TimelineSettings {
  readonly outputGain: Numeric<'db'>
}

const timelineSettingsSchema: Struct<TimelineSettings> = type({
  outputGain: validateNumeric('db')
})

const timelineSettingsDefaults: TimelineSettings = {
  outputGain: defaultOutputGain
}

export const outputGainDomain: PersistenceDomain<TimelineSettings> = {
  key: 'timeline',
  fallbackValue: timelineSettingsDefaults,
  serialize: (value) => value,
  deserialize: (value) => timelineSettingsSchema.create(value),
  areEqual: (a, b) => a.outputGain.value === b.outputGain.value
}

export function useTimelineSettingsSync (): void {
  const audioEngine = useAudioEngine()
  const outputGain = useObservable(audioEngine.outputGain)

  usePersistentBinding(outputGainDomain, { outputGain }, (persisted) => {
    audioEngine.outputGain.set(persisted.outputGain)
  }, { onConflict: 'accept-remote' })
}
