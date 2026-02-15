import type { Program } from '@core/program.js'
import type { AudioFetcher } from './assets/fetcher.js'
import { createBuses } from './buses.js'
import type { BaseMixin } from './instances.js'
import { createInstruments } from './instruments.js'
import { scheduleNoteEvents } from './parts.js'
import { setupRoutings } from './routings.js'
import type { Transport } from './transport.js'

export interface AudioGraph {
  /**
   * Resolves once all instances have finished their load attempts.
   * Rejects if any instance fails to load or the timeout is reached.
   */
  readonly loaded: Promise<void>

  readonly dispose: () => void
  readonly disposed: boolean
}

export function createAudioGraph (
  transport: Transport,
  program: Program,
  fetcher: AudioFetcher
): AudioGraph {
  const buses = createBuses(transport, program)
  const instruments = createInstruments(transport, program, fetcher)

  const instances: BaseMixin[] = [
    ...buses.values(),
    ...instruments.values()
  ]

  setupRoutings(transport, program, instruments, buses)
  scheduleNoteEvents(program, instruments)

  const loaded = Promise.all(
    instances.map(async (item) => await item.loaded)
  ).then(() => undefined)

  let disposed = false

  return {
    loaded,

    get disposed () {
      return disposed
    },

    dispose: () => {
      if (disposed) {
        return
      }

      disposed = true
      for (const item of instances) {
        item.dispose()
      }
    }
  }
}
