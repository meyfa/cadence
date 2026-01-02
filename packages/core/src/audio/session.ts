import { getTransport } from 'tone'
import { MutableObservable, type Observable } from '../observable.js'
import type { Program } from '../program.js'
import { createBuses } from './buses.js'
import { createParts } from './parts.js'
import { createPlayers } from './players.js'
import { beatsToSeconds, calculateTotalDuration } from './time.js'
import type { BeatRange } from './types.js'

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

  const [buses, busesLoaded] = createBuses(program)
  const [players, playersLoaded] = createPlayers(program, buses)
  const parts = createParts(program, players)

  let disposed = false

  const ended = new MutableObservable(false)
  const progress = new MutableObservable(initialProgress)

  let progressInterval: ReturnType<typeof setInterval> | undefined

  const start = () => {
    if (disposed) {
      return
    }

    const loaded = Promise.all([busesLoaded, playersLoaded])
    const timeout = new Promise((resolve) => setTimeout(resolve, LOAD_TIMEOUT_MS))

    Promise.race([loaded, timeout])
      .then(() => {
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
      })
      .catch(() => {})
  }

  const dispose = () => {
    if (disposed) {
      return
    }

    disposed = true

    for (const busNodes of buses.values()) {
      busNodes.dispose()
    }

    for (const part of parts.values()) {
      part.stop().dispose()
    }

    for (const player of players.values()) {
      player.stop().dispose()
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
