import { getTransport, type Sequence } from 'tone'
import { MutableObservable, type Observable } from '../observable.js'
import type { InstrumentId, Program, Step } from '../program.js'
import { createPlayers } from './players.js'
import { createSequences } from './sequences.js'

const LOAD_TIMEOUT_MS = 3000

export interface AudioSession {
  readonly ended: Observable<boolean>
  readonly progress: Observable<number>
  readonly start: () => void
  readonly dispose: () => void
}

export function createAudioSession (program: Program): AudioSession {
  const [players, playersLoaded] = createPlayers(program)
  const sequences = createSequences(players, program)
  const totalDuration = calculateTotalDuration(sequences)

  let disposed = false

  const ended = new MutableObservable(false)
  const progress = new MutableObservable(0)

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
          getTransport().bpm.value = program.track.tempo.value
          sequences.forEach((sequence) => sequence.start())
          getTransport().scheduleOnce(() => ended.set(true), totalDuration)
          getTransport().start('+0.05')

          progressInterval = setInterval(() => {
            if (!disposed) {
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
      for (const sequence of sequences.values()) {
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

function calculateTotalDuration (sequences: Map<InstrumentId, Sequence<Step>>): number {
  let maxLength = 0

  for (const sequence of sequences.values()) {
    maxLength = Math.max(maxLength, sequence.length * sequence.subdivision)
  }

  return maxLength
}
