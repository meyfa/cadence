import { getTransport } from 'tone'
import { MutableObservable, type Observable } from '../observable.js'
import type { Program } from '../program.js'
import { createPlayers } from './players.js'
import { createSequences, startSequences } from './sequences.js'

const LOAD_TIMEOUT_MS = 3000

export interface AudioSession {
  readonly ended: Observable<boolean>
  readonly start: () => void
  readonly dispose: () => void
}

export function createAudioSession (program: Program): AudioSession {
  const [players, playersLoaded] = createPlayers(program)
  const sequences = createSequences(players, program)

  let disposed = false

  const ended = new MutableObservable(false)

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
          startSequences(sequences, () => ended.set(true))
          getTransport().start('+0.05')
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
    }
  }

  return { start, dispose, ended }
}

function resetTransport (): void {
  const transport = getTransport()
  transport.stop()
  transport.cancel()
  transport.position = 0
}
