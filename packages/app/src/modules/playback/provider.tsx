import { useSafeContext } from '@editor'
import { createContext, type FunctionComponent, type PropsWithChildren } from 'react'
import { numeric } from '@utility'
import { createAudioEngine, type AudioEngine, type AudioEngineOptions } from '@webaudio'
import { defaultOutputGain } from './persistence.js'

const AudioEngineContext = createContext<AudioEngine | undefined>(undefined)

const lowMemoryDevice = 'deviceMemory' in navigator
  ? (navigator as any).deviceMemory <= 2
  : undefined

const likelyMobile = 'userAgentData' in navigator && 'mobile' in (navigator as any).userAgentData
  ? (navigator as any).userAgentData.mobile === true
  : matchMedia('(pointer: coarse)').matches && Math.min(window.screen.width, window.screen.height) <= 768

const audioEngineOptions = {
  assetLoadTimeout: numeric('s', 5),
  cacheLimits: lowMemoryDevice === true || likelyMobile
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
