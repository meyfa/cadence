import { getTransport } from 'tone'
import { MutableObservable, type Observable } from '../observable.js'
import type { Program } from '../program.js'
import { createBuses } from './buses.js'
import { createPlayers } from './players.js'
import { createSequences } from './sequences.js'
import type { StepRange } from './types.js'

const LOAD_TIMEOUT_MS = 3000

export interface AudioSession {
  readonly ended: Observable<boolean>
  readonly progress: Observable<number>
  readonly start: () => void
  readonly dispose: () => void
}

export function createAudioSession (program: Program, range: StepRange): AudioSession {
  const bpm = program.track.tempo.value
  const totalDuration = calculateTotalDuration(program)

  const startOffsetSeconds = (range.start.value * 60) / (program.stepsPerBeat * bpm)
  const endOffsetSeconds = range.end != null
    ? (range.end.value * 60) / (program.stepsPerBeat * bpm)
    : totalDuration

  const initialProgress = totalDuration > 0 ? Math.min(1, startOffsetSeconds / totalDuration) : 0

  // If true, nothing should be played at all, because the start is after the end
  const endImmediately = endOffsetSeconds <= 0 || startOffsetSeconds >= endOffsetSeconds

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
        if (!disposed) {
          resetTransport()
          getTransport().bpm.value = bpm

          if (endImmediately) {
            ended.set(true)
            progress.set(1)
            return
          }

          sequences.forEach(([sequence, offset]) => sequence.start(offset))
          getTransport().scheduleOnce(() => ended.set(true), endOffsetSeconds)
          getTransport().start('+0.05', startOffsetSeconds)

          progressInterval = setInterval(() => {
            if (!disposed && getTransport().state === 'started') {
              const progressValue = getTransport().seconds / Math.max(0.001, totalDuration)
              progress.set(Math.max(0, Math.min(1, progressValue)))
            }
          }, 16)
        }
      })
      .catch(() => {})
  }

  const dispose = () => {
    if (!disposed) {
      disposed = true
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
  }

  return { start, dispose, ended, progress }
}

function resetTransport (): void {
  const transport = getTransport()
  transport.stop()
  transport.cancel()
  transport.position = 0
}

function calculateTotalDuration (program: Program): number {
  const steps = program.track.sections.reduce((total, section) => total + section.length.value, 0)
  return steps * 60 / (program.stepsPerBeat * program.track.tempo.value)
}
