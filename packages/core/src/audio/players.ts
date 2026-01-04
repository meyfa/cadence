import { Sampler } from 'tone'
import type { BusId, InstrumentId, Program } from '../program.js'
import type { BusNodes } from './buses.js'
import { DEFAULT_ROOT_NOTE } from './constants.js'

type PlayersReturn = [players: Map<InstrumentId, Sampler>, loaded: Promise<void>]

export function createPlayers (program: Program, buses: ReadonlyMap<BusId, BusNodes>): PlayersReturn {
  const players = new Map<InstrumentId, Sampler>()
  const loads: Array<Promise<Sampler>> = []

  for (const instrument of program.instruments.values()) {
    let resolve: (sampler: Sampler) => void
    let reject: (error: Error) => void

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers#description
    // eslint-disable-next-line promise/param-names
    const loadPromise = new Promise<Sampler>((res, rej) => {
      resolve = res
      reject = rej
    })

    const sampler = new Sampler({
      onload: () => resolve(sampler),
      onerror: (error) => reject(error),
      urls: {
        [instrument.rootNote ?? DEFAULT_ROOT_NOTE]: instrument.sampleUrl
      },
      volume: instrument.gain?.value,
      // declick
      attack: 0.005,
      release: 0.005
    })

    // TODO report loading errors to the user
    loads.push(loadPromise.catch(() => sampler))
    players.set(instrument.id, sampler)
  }

  const unrouted = new Set<InstrumentId>(players.keys())

  for (const routing of program.mixer.routings) {
    if (routing.source.type !== 'Instrument') {
      continue
    }

    const source = players.get(routing.source.id)
    const destination = buses.get(routing.destination.id)?.input

    if (source != null && destination != null) {
      source.connect(destination)
    }

    unrouted.delete(routing.source.id)
  }

  for (const id of unrouted) {
    players.get(id)?.toDestination()
  }

  return [players, Promise.allSettled(loads).then(() => undefined)]
}
