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
      const transport = createOfflineTransport({
        channels: options.channels,
        sampleRate: options.sampleRate,
        duration: beatsToSeconds(calculateTotalLength(program), program.track.tempo)
      })

      const graph = createAudioGraph(transport, program, fetcher)

      let audioBuffer: AudioBuffer | undefined

      try {
        await graph.loaded
        audioBuffer = await transport.render()
      } catch (err: unknown) {
        return {
          errors: [err instanceof Error ? err : new Error('Unknown error during rendering.')]
        }
      } finally {
        graph.dispose()
      }

      return { errors: [], audioBuffer }
    }
  }
}
