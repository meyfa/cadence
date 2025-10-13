import { Player } from 'tone'
import type { InstrumentId, Program } from '../program.js'

type PlayersReturn = [players: Map<InstrumentId, Player>, loaded: Promise<void>]

export function createPlayers (program: Program): PlayersReturn {
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
    }).toDestination()

    // TODO report loading errors to the user
    loads.push(player.load(instrument.sampleUrl).catch(() => player))
    players.set(instrument.id, player)
  }

  return [players, Promise.allSettled(loads).then(() => undefined)]
}
