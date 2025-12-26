import { getTransport } from 'tone'
import { MutableObservable, type Observable } from '../observable.js'
import type { Program } from '../program.js'
import { createBuses } from './buses.js'
import { createPlayers } from './players.js'
import { createSequences } from './sequences.js'
import { calculateTotalDuration, stepsToSeconds } from './time.js'
import type { StepRange } from './types.js'

const LOAD_TIMEOUT_MS = 3000

export interface AudioSession {
  readonly ended: Observable<boolean>
  readonly progress: Observable<number>
  readonly start: () => void
  readonly dispose: () => void
}

export function createAudioSession (program: Program, range: StepRange): AudioSession {
  const totalDuration = calculateTotalDuration(program)

  const startOffset = stepsToSeconds(range.start, program.track.tempo, program.stepsPerBeat)
  const endOffset = range.end != null
    ? stepsToSeconds(range.end, program.track.tempo, program.stepsPerBeat)
    : totalDuration

  const initialProgress = totalDuration.value > 0 ? Math.min(1, startOffset.value / totalDuration.value) : 0

  // If true, nothing should be played at all, because the start is after the end
  const endImmediately = endOffset.value <= 0 || startOffset.value >= endOffset.value

  const buses = createBuses(program)
  const [players, playersLoaded] = createPlayers(program, buses)
  const sequences = createSequences(program, players)

  let disposed = false

  const ended = new MutableObservable(false)
  const progress = new MutableObservable(initialProgress)

  let progressInterval: ReturnType<typeof setInterval> | undefined

  const start = () => {
    if (disposed) {
      return
    }

    const timeout = new Promise((resolve) => setTimeout(resolve, LOAD_TIMEOUT_MS))

    Promise.race([playersLoaded, timeout])
      .then(() => {
        if (disposed) {
          return
        }

        resetTransport()
        getTransport().bpm.value = program.track.tempo.value

        if (endImmediately) {
          ended.set(true)
          progress.set(1)
          return
        }

        sequences.forEach(([sequence, offset]) => sequence.start(offset))
        getTransport().scheduleOnce(() => ended.set(true), endOffset.value)
        getTransport().start('+0.05', startOffset.value)

        progressInterval = setInterval(() => {
          if (!disposed && getTransport().state === 'started') {
            const progressValue = getTransport().seconds / Math.max(0.001, totalDuration.value)
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

    for (const [sequence] of sequences.values()) {
      sequence.stop().dispose()
    }

    for (const player of players.values()) {
      player.stop().dispose()
    }

    resetTransport()

    if (progressInterval) {
      clearInterval(progressInterval)
      progressInterval = undefined
    }

    progress.set(0)
  }

  return { start, dispose, ended, progress }
}

function resetTransport (): void {
  const transport = getTransport()
  transport.stop()
  transport.cancel()
  transport.position = 0
}
