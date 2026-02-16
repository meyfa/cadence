import type { Numeric, Program } from '@core/program.js'
import { beatsToSeconds, calculateTotalLength } from '@core/time.js'
import { createAudioFetcher } from './assets/fetcher.js'
import { createAudioGraph } from './graph.js'
import { createOfflineTransport } from './transport.js'

export interface AudioRendererOptions {
  readonly channels: number
  readonly sampleRate: number
  readonly assetLoadTimeout: Numeric<'s'>
  readonly cacheLimits: {
    readonly arrayBuffer: number
    readonly audioBuffer: number
  }

  readonly onProgress?: (progress: number) => void
}

export interface AudioRenderResult {
  readonly errors: readonly Error[]
  readonly audioBuffer?: AudioBuffer
}

export interface AudioRenderer {
  readonly render: (program: Program) => Promise<AudioRenderResult>
}

export function createAudioRenderer (options: AudioRendererOptions): AudioRenderer {
  const fetcher = createAudioFetcher({
    timeout: options.assetLoadTimeout,
    cacheLimits: options.cacheLimits
  })

  return {
    render: async (program) => {
      const cleanupHooks: Array<() => void> = []

      const duration = beatsToSeconds(calculateTotalLength(program), program.track.tempo)
      const safeDuration = Math.max(0.001, duration.value)

      const transport = createOfflineTransport({
        channels: options.channels,
        sampleRate: options.sampleRate,
        duration
      })

      const graph = createAudioGraph(transport, program, fetcher)
      cleanupHooks.push(() => graph.dispose())

      if (options.onProgress != null) {
        cleanupHooks.push(transport.time.subscribe((time) => {
          if (time == null) {
            return
          }
          options.onProgress?.(Math.max(0, Math.min(1, time.value / safeDuration)))
        }))
      }

      let audioBuffer: AudioBuffer | undefined

      try {
        await graph.loaded
        audioBuffer = await transport.render()
      } catch (err: unknown) {
        return {
          errors: [err instanceof Error ? err : new Error('Unknown error during rendering.')]
        }
      } finally {
        cleanupHooks.reverse()
        cleanupHooks.forEach((hook) => hook())
        cleanupHooks.splice(0, cleanupHooks.length)
      }

      return { errors: [], audioBuffer }
    }
  }
}
