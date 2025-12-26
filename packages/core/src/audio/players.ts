import { Player } from 'tone'
import type { BusId, InstrumentId, Program } from '../program.js'
import type { BusNodes } from './buses.js'

type PlayersReturn = [players: Map<InstrumentId, Player>, loaded: Promise<void>]

export function createPlayers (program: Program, buses: ReadonlyMap<BusId, BusNodes>): PlayersReturn {
  const players = new Map<InstrumentId, Player>()
  const loads: Array<Promise<Player>> = []

  for (const instrument of program.instruments.values()) {
    const player = new Player({
      volume: instrument.gain?.value,
      autostart: false,
      loop: false,
      // declick
      fadeIn: 0.005,
      fadeOut: 0.005
    })

    // TODO report loading errors to the user
    loads.push(player.load(instrument.sampleUrl).catch(() => player))
    players.set(instrument.id, player)
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
