import { MutableObservable, type Observable } from '@core/observable.js'
import { makeNumeric, type Numeric, type Program } from '@core/program.js'
import { beatsToSeconds, calculateTotalLength } from '@core/time.js'
import type { BeatRange } from '@core/types.js'
import { getTransport } from 'tone'
import { createBuses } from './buses.js'
import { createInstruments } from './instruments.js'
import { createParts } from './parts.js'
import { setupRoutings } from './routings.js'

const ErrorMessages = Object.freeze({
  LoadTimeout: 'Timeout while loading assets; some audio may be missing.',
  Unknown: 'An unknown error occurred during audio playback.'
})

const LOAD_TIMEOUT_MS = 3000

export interface AudioSession {
  readonly ended: Observable<boolean>
  readonly position: Observable<Numeric<'beats'>>
  readonly errors: Observable<readonly Error[]>
  readonly start: () => void
  readonly dispose: () => void
}

export function createAudioSession (program: Program, range: BeatRange): AudioSession {
  const transport = getTransport()

  // This must be done before any objects are created that may refer to the transport
  resetTransport(transport)
  transport.bpm.value = program.track.tempo.value

  const endPosition = range.end ?? calculateTotalLength(program)
  const startTime = beatsToSeconds(range.start, program.track.tempo)
  const endTime = beatsToSeconds(endPosition, program.track.tempo)

  // If true, nothing should be played at all, because the start is after the end
  const endImmediately = endPosition.value <= 0 || range.start.value >= endPosition.value

  const buses = createBuses(program)
  const instruments = createInstruments(program)
  const parts = createParts(program, instruments)

  const instances = [
    ...buses.values(),
    ...instruments.values(),
    ...parts.values()
  ]

  setupRoutings(program, instruments, buses)

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

    parts.forEach((part) => part.start(0))
    transport.scheduleOnce(() => ended.set(true), endTime.value)
    transport.start('+0.05', startTime.value)

    progressInterval = setInterval(() => {
      if (!disposed && transport.state === 'started') {
        position.set(makeNumeric('beats', transport.seconds * program.track.tempo.value / 60))
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
      setTimeout(resolve, LOAD_TIMEOUT_MS, 'timeout')
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

    resetTransport(transport)

    if (progressInterval) {
      clearInterval(progressInterval)
      progressInterval = undefined
    }

    position.set(endPosition)
  }

  return { ended, position, errors, start, dispose }
}

function resetTransport (transport: ReturnType<typeof getTransport>): void {
  transport.stop()
  transport.cancel()
  transport.position = 0
}
