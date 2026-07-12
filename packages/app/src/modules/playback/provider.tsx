import { useSafeContext } from '@editor'
import { runtimeNumeric } from '@utility'
import type { AudioEngine, AudioEngineOptions } from '@webaudio'
import { createAudioEngine } from '@webaudio'
import type { FunctionComponent, PropsWithChildren } from 'react'
import { createContext } from 'react'
import { isLikelyMobile, isLowMemoryDevice } from '../../utilities/features.js'
import { defaultOutputGain } from './persistence.js'

const AudioEngineContext = createContext<AudioEngine | undefined>(undefined)

const audioEngineOptions = {
  assetLoadTimeout: runtimeNumeric('s', 5),
  cacheLimits: isLowMemoryDevice() === true || isLikelyMobile()
    ? {
        arrayBuffer: runtimeNumeric('bytes', 60 * 1024 * 1024), // compressed: 60 MB
        audioBuffer: runtimeNumeric('bytes', 30 * 1024 * 1024) // decompressed: 30 MB
      }
    : {
        arrayBuffer: runtimeNumeric('bytes', 200 * 1024 * 1024), // compressed: 200 MB
        audioBuffer: runtimeNumeric('bytes', 100 * 1024 * 1024) // decompressed: 100 MB
      }
} satisfies Partial<AudioEngineOptions>

const engine = createAudioEngine({
  ...audioEngineOptions,
  outputGain: defaultOutputGain
})

export const PlaybackProvider: FunctionComponent<PropsWithChildren> = ({ children }) => {
  return (
    <AudioEngineContext value={engine}>
      {children}
    </AudioEngineContext>
  )
}

export function useAudioEngine (): AudioEngine {
  return useSafeContext(AudioEngineContext, 'AudioEngineContext')
}
