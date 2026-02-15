import type { Numeric } from '@core/program.js'
import { createAssetCache, type AssetCache } from './cache.js'

export interface AudioFetcherOptions {
  readonly timeout: Numeric<'s'>
  readonly cacheLimits: {
    readonly arrayBuffer: number
    readonly audioBuffer: number
  }
}

export interface AudioFetcher {
  readonly fetch: (ctx: BaseAudioContext, url: string | URL) => Promise<AudioBuffer>
}

export function createAudioFetcher (options: AudioFetcherOptions): AudioFetcher {
  // This uses two levels of caching as the decoded audio is typically much larger
  // than the raw data fetched from the network.

  const arrayBufferCache = options.cacheLimits.arrayBuffer > 0
    ? createAssetCache<ArrayBuffer>({
        maxSize: options.cacheLimits.arrayBuffer,
        getSize: (value) => value.byteLength
      })
    : undefined

  const audioBufferCache = options.cacheLimits.audioBuffer > 0
    ? createAssetCache<AudioBuffer>({
        maxSize: options.cacheLimits.audioBuffer,
        getSize: (value) => value.length * value.numberOfChannels * 4 // 32-bit float
      })
    : undefined

  return {
    fetch: async (ctx: BaseAudioContext, url: string | URL) => {
      const signal = AbortSignal.timeout(options.timeout.value * 1000)

      try {
        return await fetchAudioBuffer(ctx, url, signal, {
          arrayBufferCache,
          audioBufferCache
        })
      } catch (err: unknown) {
        if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
          throw new Error(`Load timed out: ${url.toString()}`)
        }

        throw err instanceof Error ? err : new Error(`Load failed: ${url.toString()}`)
      }
    }
  }
}

export async function fetchArrayBuffer (
  url: string | URL,
  signal?: AbortSignal,
  cache?: AssetCache<ArrayBuffer>
): Promise<ArrayBuffer> {
  const key = url.toString()

  const cached = cache?.get(key)
  if (cached != null) {
    return cached
  }

  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Failed to load asset: ${response.status} ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  cache?.set(key, arrayBuffer)

  return arrayBuffer
}

export async function fetchAudioBuffer (
  ctx: BaseAudioContext,
  url: string | URL,
  signal?: AbortSignal,
  caches?: {
    readonly arrayBufferCache?: AssetCache<ArrayBuffer>
    readonly audioBufferCache?: AssetCache<AudioBuffer>
  }
): Promise<AudioBuffer> {
  const key = url.toString()

  const cached = caches?.audioBufferCache?.get(key)
  if (cached != null) {
    if (cached.sampleRate == ctx.sampleRate) {
      return cached
    }

    // sample rate has changed
    caches?.audioBufferCache?.delete(key)
  }

  const arrayBuffer = await fetchArrayBuffer(url, signal, caches?.arrayBufferCache)

  // The spec suggests that the ArrayBuffer should become "detached" during decoding.
  // If we cache the ArrayBuffer, decode from a copy to keep the cached value intact.
  const decodeInput = caches?.arrayBufferCache != null ? arrayBuffer.slice(0) : arrayBuffer

  const audioBuffer = await ctx.decodeAudioData(decodeInput)
  caches?.audioBufferCache?.set(key, audioBuffer)

  return audioBuffer
}
