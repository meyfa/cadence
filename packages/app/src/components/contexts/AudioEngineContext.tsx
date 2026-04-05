import { useSafeContext } from '@editor'
import type { AudioEngine } from '@webaudio'
import { createContext } from 'react'

export const AudioEngineContext = createContext<AudioEngine | undefined>(undefined)

export function useAudioEngine (): AudioEngine {
  return useSafeContext(AudioEngineContext, 'AudioEngineContext')
}
