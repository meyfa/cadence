import { MutableObservable, type Observable } from '@core/observable.js'
import { makeNumeric, type Numeric, type Program } from '@core/program.js'
import { beatsToSeconds, calculateTotalLength } from '@core/time.js'
import type { BeatRange } from '@core/types.js'
import { createBuses } from './buses.js'
import { dbToGain } from './conversion.js'
import { createInstruments } from './instruments.js'
import { scheduleNoteEvents } from './parts.js'
import { setupRoutings } from './routings.js'
import { createTransport } from './transport.js'
import type { AudioFetcher } from './assets/fetcher.js'

const ErrorMessages = Object.freeze({
  LoadTimeout: 'Timeout while loading assets; some audio may be missing.',
  Unknown: 'An unknown error occurred during audio playback.'
})

/**
 * Number of seconds to wait for assets to load before starting playback anyway.
 */
const LOAD_TIMEOUT = 3.0

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

  const transport = createTransport()
  transport.output.gain.value = dbToGain(outputGain.get().value)

  const unsubscribeOutputGain = outputGain.subscribe(({ value }) => {
    const gain = transport.output.gain
    const currentTime = transport.ctx.currentTime
    gain.setValueAtTime(gain.value, currentTime)
    gain.linearRampToValueAtTime(dbToGain(value), currentTime + 0.05)
  })

  const buses = createBuses(transport, program)
  const instruments = createInstruments(transport, program, fetcher)

  const instances = [
    ...buses.values(),
    ...instruments.values()
  ]

  setupRoutings(transport, program, instruments, buses)
  scheduleNoteEvents(program, instruments)

  let disposed = false

  const ended = new MutableObservable(false)
  const position = new MutableObservable(range.start)
  const errors = new MutableObservable<readonly Error[]>([])

  const appendError = (err: unknown) => {
    const error = err instanceof Error ? err : new Error(ErrorMessages.Unknown)
    errors.set([...errors.get(), error])
  }

  let progressInterval: ReturnType<typeof setInterval> | undefined

  const startNow = () => {
    if (disposed) {
      return
    }

    if (endImmediately) {
      ended.set(true)
      position.set(endPosition)
      return
    }

    transport.start(startTime.value).then(() => {
      if (disposed) {
        return
      }

      setTimeout(() => {
        if (!disposed) {
          ended.set(true)
        }
      }, (endTime.value - startTime.value) * 1000)
    }).catch(appendError)

    progressInterval = setInterval(() => {
      if (!disposed) {
        const seconds = Math.max(startTime.value, transport.now())
        position.set(makeNumeric('beats', seconds * program.track.tempo.value / 60))
      }
    }, 16)
  }

  const start = () => {
    if (disposed) {
      return
    }

    type RaceResult = 'loaded' | 'timeout'

    const loaded: Promise<RaceResult> = Promise.all(
      instances.map((item) => item.loaded.catch(appendError))
    ).then(() => 'loaded')

    const timeout = new Promise<RaceResult>((resolve) => {
      setTimeout(resolve, LOAD_TIMEOUT * 1000, 'timeout')
    })

    Promise.race([loaded, timeout])
      .then((result) => {
        if (result === 'timeout') {
          appendError(new Error(ErrorMessages.LoadTimeout))
        }

        startNow()
      })
      .catch(appendError)
  }

  const dispose = () => {
    if (disposed) {
      return
    }

    disposed = true

    for (const item of instances) {
      item.dispose()
    }

    unsubscribeOutputGain()
    transport.dispose().catch(appendError)

    if (progressInterval) {
      clearInterval(progressInterval)
      progressInterval = undefined
    }

    position.set(endPosition)
  }

  return { ended, position, errors, start, dispose }
}
