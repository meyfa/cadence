import { getTransport } from 'tone'
import { MutableObservable, type Observable } from '../observable.js'
import type { Program } from '../program.js'
import type { BeatRange } from '../types.js'
import { createBuses } from './buses.js'
import { createInstruments } from './instruments.js'
import { createParts } from './parts.js'
import { setupRoutings } from './routings.js'
import { beatsToSeconds, calculateTotalDuration } from './time.js'

const LOAD_TIMEOUT_MS = 3000

export interface AudioSession {
  readonly ended: Observable<boolean>
  readonly progress: Observable<number>
  readonly start: () => void
  readonly dispose: () => void
}

export function createAudioSession (program: Program, range: BeatRange): AudioSession {
  const transport = getTransport()

  // This must be done before any objects are created that may refer to the transport
  resetTransport(transport)
  transport.bpm.value = program.track.tempo.value

  const totalDuration = calculateTotalDuration(program)

  const startOffset = beatsToSeconds(range.start, program.track.tempo)
  const endOffset = range.end != null
    ? beatsToSeconds(range.end, program.track.tempo)
    : totalDuration

  const initialProgress = totalDuration.value > 0 ? Math.min(1, startOffset.value / totalDuration.value) : 0

  // If true, nothing should be played at all, because the start is after the end
  const endImmediately = endOffset.value <= 0 || startOffset.value >= endOffset.value

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
  const progress = new MutableObservable(initialProgress)

  let progressInterval: ReturnType<typeof setInterval> | undefined

  const startNow = () => {
    if (disposed) {
      return
    }

    if (endImmediately) {
      ended.set(true)
      progress.set(1)
      return
    }

    parts.forEach((part) => part.start(0))
    transport.scheduleOnce(() => ended.set(true), endOffset.value)
    transport.start('+0.05', startOffset.value)

    progressInterval = setInterval(() => {
      if (!disposed && transport.state === 'started') {
        const progressValue = transport.seconds / Math.max(0.001, totalDuration.value)
        progress.set(Math.max(0, Math.min(1, progressValue)))
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

    progress.set(0)
  }

  return { start, dispose, ended, progress }
}

function resetTransport (transport: ReturnType<typeof getTransport>): void {
  transport.stop()
  transport.cancel()
  transport.position = 0
}
