import type { AudioGraph, Node } from '@audiograph'
import { beatsToSeconds, dbToGain } from '@core'
import type { Numeric, Observable } from '@utility'
import { DisposeStack, MutableObservable, numeric } from '@utility'
import type { AudioFetcher } from '../assets/fetcher.js'
import type { MeterCallbacks } from '../graph/factory.js'
import { createWebAudioGraph } from '../graph/graph.js'
import { createOnlineTransport } from '../transport/transport.js'
import type { BeatRange } from './types.js'

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
  fetcher: AudioFetcher,
  meterCallbacks: MeterCallbacks
): AudioSession {
  const disposeStack = new DisposeStack()

  const endPosition = range.end ?? graph.length
  const startTime = beatsToSeconds(range.start, graph.tempo)
  const endTime = beatsToSeconds(endPosition, graph.tempo)

  // Whether nothing should be played at all because the start is after the end
  const endImmediately = endPosition.value <= 0 || range.start.value >= endPosition.value

  const transport = createOnlineTransport()
  disposeStack.pushDisposable(transport)

  transport.output.gain.value = dbToGain(outputGain.get()).value

  disposeStack.push(outputGain.subscribe((value) => {
    const gain = transport.output.gain
    const currentTime = transport.ctx.currentTime
    gain.setValueAtTime(gain.value, currentTime)
    gain.linearRampToValueAtTime(dbToGain(value).value, currentTime + 0.05)
  }))

  const ended = new MutableObservable(false)
  const position = new MutableObservable(range.start)
  const errors = new MutableObservable<readonly Error[]>([])

  const webAudioGraphPromise = createWebAudioGraph(graph, transport, fetcher, meterCallbacks)
    .then((webAudioGraph) => {
      disposeStack.pushDisposable(webAudioGraph)
      return webAudioGraph
    })

  let disposed = false

  const start = () => {
    webAudioGraphPromise.then(() => {
      if (disposed) {
        return
      }

      if (endImmediately) {
        ended.set(true)
        position.set(endPosition)
        return
      }

      return transport.start(startTime)
    }).then(() => {
      if (disposed) {
        return
      }

      const endTimeout = setTimeout(() => {
        if (!disposed) {
          ended.set(true)
        }
      }, (endTime.value - startTime.value) * 1000)

      disposeStack.push(() => clearTimeout(endTimeout))

      // Track position based on render-thread time updates.
      disposeStack.push(transport.time.subscribe((time) => {
        if (!disposed) {
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
    if (disposed) {
      return
    }

    disposed = true
    disposeStack.dispose()

    ended.set(true)
    position.set(endPosition)
  }

  return { ended, position, errors, start, dispose }
}
