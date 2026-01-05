import { getTransport } from 'tone'
import { MutableObservable, type Observable } from '../observable.js'
import { makeNumeric, type Numeric, type Program } from '../program.js'
import type { BeatRange } from '../types.js'
import { createBuses } from './buses.js'
import { createInstruments } from './instruments.js'
import { createParts } from './parts.js'
import { setupRoutings } from './routings.js'
import { beatsToSeconds, calculateTotalLength } from './time.js'

const LOAD_TIMEOUT_MS = 3000

export interface AudioSession {
  readonly ended: Observable<boolean>
  readonly position: Observable<Numeric<'beats'>>
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

    Promise.race([
      Promise.allSettled(instances.map((item) => item.loaded.catch(() => {}))),
      new Promise((resolve) => setTimeout(resolve, LOAD_TIMEOUT_MS))
    ])
      .then(() => startNow())
      .catch(() => {})
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

  return { start, dispose, ended, position }
}

function resetTransport (transport: ReturnType<typeof getTransport>): void {
  transport.stop()
  transport.cancel()
  transport.position = 0
}
