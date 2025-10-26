import type { AudioEngine } from '@core/audio/engine.js'
import { createContext, useContext } from 'react'

// This will be mounted by the top-level App component, so for simplicity, we don't provide a fallback here.
export const AudioEngineContext = createContext<AudioEngine>(undefined as any)

export function useAudioEngine (): AudioEngine {
  return useContext(AudioEngineContext)
}
