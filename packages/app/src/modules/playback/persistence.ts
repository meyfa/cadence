import type { PersistenceDomain } from '@meyfa/cadence-editor'
import { useObservable, usePersistentBinding } from '@meyfa/cadence-editor'
import type { RuntimeNumeric } from '@meyfa/cadence-utility'
import { runtimeNumeric } from '@meyfa/cadence-utility'
import type { Struct } from 'superstruct'
import { type } from 'superstruct'
import { validateRuntimeNumeric } from '../../utilities/validation.ts'
import { useAudioEngine } from './provider.tsx'

export const defaultOutputGain = runtimeNumeric('db', -12)

interface PlaybackSettings {
  readonly outputGain: RuntimeNumeric<'db'>
}

const playbackSettingsSchema: Struct<PlaybackSettings> = type({
  outputGain: validateRuntimeNumeric('db')
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

  usePersistentBinding(outputGainDomain, {
    outputGain: runtimeNumeric('db', outputGain)
  }, (persisted) => {
    audioEngine.outputGain.set(persisted.outputGain.value)
  }, { onConflict: 'accept-remote' })
}
