import { MutableObservable, type Observable } from '@core/observable.js'
import { makeNumeric, type Numeric, type Program } from '@core/program.js'
import { beatsToSeconds, calculateTotalLength } from '@core/time.js'
import type { BeatRange } from '@core/types.js'
import type { AudioFetcher } from './assets/fetcher.js'
import { dbToGain } from './conversion.js'
import { createAudioGraph, ErrorMessages } from './graph.js'
import { createOnlineTransport } from './transport.js'

/**
 * Number of seconds to wait for assets to load before aborting.
 */
const LOAD_TIMEOUT = makeNumeric('s', 5)

export interface AudioSession {
  readonly ended: Observable<boolean>
  readonly position: Observable<Numeric<'beats'>>
  readonly errors: Observable<readonly Error[]>
  readonly start: () => void
  readonly dispose: () => void
}

export function createAudioSession (
  program: Program,
  range: BeatRange,
  outputGain: Observable<Numeric<'db'>>,
  fetcher: AudioFetcher
): AudioSession {
  const endPosition = range.end ?? calculateTotalLength(program)
  const startTime = beatsToSeconds(range.start, program.track.tempo)
  const endTime = beatsToSeconds(endPosition, program.track.tempo)

  // Whether nothing should be played at all because the start is after the end
  const endImmediately = endPosition.value <= 0 || range.start.value >= endPosition.value

  const transport = createOnlineTransport()
  transport.output.gain.value = dbToGain(outputGain.get().value)

  const unsubscribeOutputGain = outputGain.subscribe(({ value }) => {
    const gain = transport.output.gain
    const currentTime = transport.ctx.currentTime
    gain.setValueAtTime(gain.value, currentTime)
    gain.linearRampToValueAtTime(dbToGain(value), currentTime + 0.05)
  })

  const ended = new MutableObservable(false)
  const position = new MutableObservable(range.start)
  const errors = new MutableObservable<readonly Error[]>([])

  const graph = createAudioGraph(transport, program, fetcher, LOAD_TIMEOUT)

  // Timers set via setTimeout and setInterval share an ID pool
  // https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#dom-cleartimeout-dev
  const timers: Array<ReturnType<typeof setTimeout>> = []

  const start = () => {
    graph.loaded.then(() => {
      if (graph.disposed) {
        return
      }

      if (endImmediately) {
        ended.set(true)
        position.set(endPosition)
        return
      }

      return transport.start(startTime.value)
    }).then(() => {
      if (graph.disposed) {
        return
      }

      timers.push(setTimeout(() => {
        if (!graph.disposed) {
          ended.set(true)
        }
      }, (endTime.value - startTime.value) * 1000))

      timers.push(setInterval(() => {
        if (!graph.disposed) {
          const seconds = Math.max(startTime.value, transport.now())
          position.set(makeNumeric('beats', seconds * program.track.tempo.value / 60))
        }
      }, 16))
    }).catch((err: unknown) => {
      const error = err instanceof Error ? err : new Error(ErrorMessages.Unknown)
      errors.set([...errors.get(), error])
    })
  }

  const dispose = () => {
    if (graph.disposed) {
      return
    }

    for (const timer of timers) {
      clearTimeout(timer)
    }

    unsubscribeOutputGain()
    graph.dispose()
    transport.dispose()

    position.set(endPosition)
  }

  return { ended, position, errors, start, dispose }
}
