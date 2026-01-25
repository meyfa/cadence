import type { AudioEngine } from '@webaudio/engine.js'
import { createContext } from 'react'
import { useSafeContext } from '../hooks/context.js'

export const AudioEngineContext = createContext<AudioEngine | undefined>(undefined)

export function useAudioEngine (): AudioEngine {
  return useSafeContext(AudioEngineContext, 'AudioEngineContext')
}
