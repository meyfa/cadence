import { useSafeContext } from '@editor'
import { numeric } from '@utility'
import { createAudioEngine, type AudioEngine, type AudioEngineOptions } from '@webaudio'
import { createContext, type FunctionComponent, type PropsWithChildren } from 'react'
import { isLikelyMobile, isLowMemoryDevice } from '../../utilities/features.js'
import { defaultOutputGain } from './persistence.js'

const AudioEngineContext = createContext<AudioEngine | undefined>(undefined)

const audioEngineOptions = {
  assetLoadTimeout: numeric('s', 5),
  cacheLimits: isLowMemoryDevice() === true || isLikelyMobile()
    ? {
        arrayBuffer: numeric('bytes', 60 * 1024 * 1024), // compressed: 60 MB
        audioBuffer: numeric('bytes', 30 * 1024 * 1024) // decompressed: 30 MB
      }
    : {
        arrayBuffer: numeric('bytes', 200 * 1024 * 1024), // compressed: 200 MB
        audioBuffer: numeric('bytes', 100 * 1024 * 1024) // decompressed: 100 MB
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
