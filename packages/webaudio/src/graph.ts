import type { BusId, InstrumentId, Program } from '@core/program.js'
import type { AudioFetcher } from './assets/fetcher.js'
import { createBus } from './nodes/bus.js'
import { createSampleInstrument } from './nodes/sample.js'
import type { Instance } from './nodes/types.js'
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

export function createAudioGraph (program: Program, transport: Transport, fetcher: AudioFetcher): AudioGraph {
  const buses = createBuses(program, transport)
  const instruments = createInstruments(program, transport, fetcher)

  const instances: Instance[] = [
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

function createBuses (program: Program, transport: Transport): ReadonlyMap<BusId, Instance> {
  return new Map(
    program.mixer.buses.map((bus) => [
      bus.id,
      createBus(program, bus, transport)
    ])
  )
}

function createInstruments (program: Program, transport: Transport, fetcher: AudioFetcher): ReadonlyMap<InstrumentId, Instance> {
  return new Map(
    [...program.instruments.values()].map((instrument) => [
      instrument.id,
      createSampleInstrument(program, instrument, transport, fetcher)
    ])
  )
}
