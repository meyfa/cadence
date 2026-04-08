import type { PersistenceDomain } from '@editor'
import { usePersistentBinding } from '@editor'
import { numeric, type Numeric } from '@utility'
import { type, type Struct } from 'superstruct'
import { useAudioEngine } from '../../components/contexts/AudioEngineContext.js'
import { useObservable } from '../../hooks/observable.js'
import { validateNumeric } from '../../utilities/validation.js'

export const defaultOutputGain = numeric('db', -12)

interface PlaybackSettings {
  readonly outputGain: Numeric<'db'>
}

const playbackSettingsSchema: Struct<PlaybackSettings> = type({
  outputGain: validateNumeric('db')
})

const playbackSettingsDefaults: PlaybackSettings = {
  outputGain: defaultOutputGain
}

export const outputGainDomain: PersistenceDomain<PlaybackSettings> = {
  key: 'playback',
  fallbackValue: playbackSettingsDefaults,
  serialize: (value) => value,
  deserialize: (value) => playbackSettingsSchema.create(value),
  areEqual: (a, b) => a.outputGain.value === b.outputGain.value
}

export function usePlaybackSettingsSync (): void {
  const audioEngine = useAudioEngine()
  const outputGain = useObservable(audioEngine.outputGain)

  usePersistentBinding(outputGainDomain, { outputGain }, (persisted) => {
    audioEngine.outputGain.set(persisted.outputGain)
  }, { onConflict: 'accept-remote' })
}
