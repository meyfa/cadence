import type { AudioGraph, Node } from '@meyfa/cadence-audiograph'
import { beatsToSeconds } from '@meyfa/cadence-core'
import type { Numeric } from '@meyfa/cadence-utility'
import { DisposeStack } from '@meyfa/cadence-utility'
import type { CacheLimits } from '../assets/fetcher.ts'
import { createAudioFetcher } from '../assets/fetcher.ts'
import { createWebAudioGraph } from '../graph/graph.ts'
import { createOfflineTransport } from '../transport/transport.ts'

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
      const safeDuration = Math.max(0.001, duration)

      const transport = createOfflineTransport({
        channels: options.channels,
        sampleRate: options.sampleRate,
        duration
      })

      if (options.onProgress != null) {
        disposeStack.push(transport.time.subscribe((time) => {
          if (time == null) {
            return
          }
          options.onProgress?.(Math.max(0, Math.min(1, time / safeDuration)))
        }))
      }

      let audioBuffer: AudioBuffer | undefined

      try {
        const webAudioGraph = await createWebAudioGraph(graph, transport, fetcher)
        disposeStack.pushDisposable(webAudioGraph)

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
