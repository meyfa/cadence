import type { AudioGraph, Node } from '@audiograph'
import { beatsToSeconds } from '@core'
import { DisposeStack, type Numeric } from '@utility'
import { createAudioFetcher, type CacheLimits } from '../assets/fetcher.js'
import { createWebAudioGraph } from '../graph/graph.js'
import { createOfflineTransport } from '../transport/transport.js'

export interface AudioRendererOptions {
  readonly assetLoadTimeout: Numeric<'s'>
  readonly cacheLimits: CacheLimits
}

export interface AudioRenderer {
  readonly render: (graph: AudioGraph<Node>, options: RenderOptions) => Promise<RenderResult>
}

export interface RenderOptions {
  readonly channels: number
  readonly sampleRate: number
  readonly onProgress?: (progress: number) => void
}

export interface RenderResult {
  readonly errors: readonly Error[]
  readonly audioBuffer?: AudioBuffer
}

export function createAudioRenderer (options: AudioRendererOptions): AudioRenderer {
  const fetcher = createAudioFetcher({
    timeout: options.assetLoadTimeout,
    cacheLimits: options.cacheLimits
  })

  return {
    render: async (graph, options) => {
      const disposeStack = new DisposeStack()

      const duration = beatsToSeconds(graph.length, graph.tempo)
      const safeDuration = Math.max(0.001, duration.value)

      const transport = createOfflineTransport({
        channels: options.channels,
        sampleRate: options.sampleRate,
        duration
      })

      const webAudioGraph = createWebAudioGraph(graph, transport, fetcher)
      disposeStack.pushDisposable(webAudioGraph)

      if (options.onProgress != null) {
        disposeStack.push(transport.time.subscribe((time) => {
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
        disposeStack.dispose()
      }

      return { errors: [], audioBuffer }
    }
  }
}
