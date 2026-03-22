import type { AudioGraph, Node } from '@audiograph'
import { dbToGain } from '@audiograph'
import { type BeatRange, beatsToSeconds, MutableObservable, numeric, type Numeric, type Observable } from '@core'
import type { AudioFetcher } from './assets/fetcher.js'
import { createWebAudioGraph } from './graph/graph.js'
import { createOnlineTransport } from './transport.js'

export interface AudioSession {
  readonly ended: Observable<boolean>
  readonly position: Observable<Numeric<'beats'>>
  readonly errors: Observable<readonly Error[]>
  readonly start: () => void
  readonly dispose: () => void
}

export function createAudioSession (
  graph: AudioGraph<Node>,
  range: BeatRange,
  outputGain: Observable<Numeric<'db'>>,
  fetcher: AudioFetcher
): AudioSession {
  const cleanupHooks: Array<() => void> = []

  const endPosition = range.end ?? graph.length
  const startTime = beatsToSeconds(range.start, graph.tempo)
  const endTime = beatsToSeconds(endPosition, graph.tempo)

  // Whether nothing should be played at all because the start is after the end
  const endImmediately = endPosition.value <= 0 || range.start.value >= endPosition.value

  const transport = createOnlineTransport()
  cleanupHooks.push(() => transport.dispose())

  transport.output.gain.value = dbToGain(outputGain.get().value)

  cleanupHooks.push(outputGain.subscribe(({ value }) => {
    const gain = transport.output.gain
    const currentTime = transport.ctx.currentTime
    gain.setValueAtTime(gain.value, currentTime)
    gain.linearRampToValueAtTime(dbToGain(value), currentTime + 0.05)
  }))

  const ended = new MutableObservable(false)
  const position = new MutableObservable(range.start)
  const errors = new MutableObservable<readonly Error[]>([])

  const webAudioGraph = createWebAudioGraph(graph, transport, fetcher)
  cleanupHooks.push(() => webAudioGraph.dispose())

  const start = () => {
    webAudioGraph.loaded.then(() => {
      if (webAudioGraph.disposed) {
        return
      }

      if (endImmediately) {
        ended.set(true)
        position.set(endPosition)
        return
      }

      return transport.start(startTime.value)
    }).then(() => {
      if (webAudioGraph.disposed) {
        return
      }

      const endTimeout = setTimeout(() => {
        if (!webAudioGraph.disposed) {
          ended.set(true)
        }
      }, (endTime.value - startTime.value) * 1000)

      cleanupHooks.push(() => clearTimeout(endTimeout))

      // Track position based on render-thread time updates.
      cleanupHooks.push(transport.time.subscribe((time) => {
        if (!webAudioGraph.disposed) {
          const clamped = Math.max(startTime.value, time.value)
          position.set(numeric('beats', clamped * graph.tempo.value / 60))
        }
      }))
    }).catch((err: unknown) => {
      const error = err instanceof Error ? err : new Error('Unknown error during playback.')
      errors.set([...errors.get(), error])
      dispose()
    })
  }

  const dispose = () => {
    if (webAudioGraph.disposed) {
      return
    }

    cleanupHooks.reverse()
    cleanupHooks.forEach((hook) => hook())
    cleanupHooks.splice(0, cleanupHooks.length)

    ended.set(true)
    position.set(endPosition)
  }

  return { ended, position, errors, start, dispose }
}
