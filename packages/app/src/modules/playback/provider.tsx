import { useSafeContext } from '@editor'
import type { Numeric } from '@utility'
import type { AudioEngine, AudioEngineOptions } from '@webaudio'
import { createAudioEngine } from '@webaudio'
import type { FunctionComponent, PropsWithChildren } from 'react'
import { createContext } from 'react'
import { isLikelyMobile, isLowMemoryDevice } from '../../utilities/features.js'
import { defaultOutputGain } from './persistence.js'

const AudioEngineContext = createContext<AudioEngine | undefined>(undefined)

const audioEngineOptions = {
  assetLoadTimeout: 5 as Numeric<'s'>,
  cacheLimits: isLowMemoryDevice() === true || isLikelyMobile()
    ? {
        arrayBuffer: (60 * 1024 * 1024) as Numeric<'bytes'>, // compressed: 60 MB
        audioBuffer: (30 * 1024 * 1024) as Numeric<'bytes'> // decompressed: 30 MB
      }
    : {
        arrayBuffer: (200 * 1024 * 1024) as Numeric<'bytes'>, // compressed: 200 MB
        audioBuffer: (100 * 1024 * 1024) as Numeric<'bytes'> // decompressed: 100 MB
      }
} satisfies Partial<AudioEngineOptions>

const engine = createAudioEngine({
  ...audioEngineOptions,
  outputGain: defaultOutputGain.value
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
