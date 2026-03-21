import type { AudioGraph } from '@audiograph/graph.js'
import type { Node } from '@audiograph/nodes.js'
import type { Numeric } from '@core/numeric.js'
import { beatsToSeconds } from '@core/time.js'
import { createAudioFetcher, type CacheLimits } from './assets/fetcher.js'
import { createWebAudioGraph } from './graph/graph.js'
import { createOfflineTransport } from './transport.js'

export interface AudioRendererOptions {
  readonly channels: number
  readonly sampleRate: number
  readonly assetLoadTimeout: Numeric<'s'>
  readonly cacheLimits: CacheLimits
  readonly onProgress?: (progress: number) => void
}

export interface AudioRenderResult {
  readonly errors: readonly Error[]
  readonly audioBuffer?: AudioBuffer
}

export interface AudioRenderer {
  readonly render: (graph: AudioGraph<Node>) => Promise<AudioRenderResult>
}

export function createAudioRenderer (options: AudioRendererOptions): AudioRenderer {
  const fetcher = createAudioFetcher({
    timeout: options.assetLoadTimeout,
    cacheLimits: options.cacheLimits
  })

  return {
    render: async (graph) => {
      const cleanupHooks: Array<() => void> = []

      const duration = beatsToSeconds(graph.length, graph.tempo)
      const safeDuration = Math.max(0.001, duration.value)

      const transport = createOfflineTransport({
        channels: options.channels,
        sampleRate: options.sampleRate,
        duration
      })

      const webAudioGraph = createWebAudioGraph(graph, transport, fetcher)
      cleanupHooks.push(() => webAudioGraph.dispose())

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
        await webAudioGraph.loaded
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
