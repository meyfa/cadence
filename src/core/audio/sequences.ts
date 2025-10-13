import { Sequence, Player } from 'tone'
import { getSilentPattern, withPatternLength } from '../pattern.js'
import { convertPitchToPlaybackRate } from '../midi.js'
import { isPitch, type Instrument, type InstrumentId, type Program, type Step } from '../program.js'

export const DEFAULT_ROOT_NOTE = 'C5' as const

export function createSequences (players: Map<InstrumentId, Player>, program: Program): Map<InstrumentId, Sequence<Step>> {
  const subdivision = `${program.beatsPerBar * program.stepsPerBeat}n`
  const sequenceEvents = createEvents(players, program)

  const sequences = new Map<InstrumentId, Sequence<Step>>()

  for (const [key, player] of players) {
    const events = sequenceEvents.get(key)
    const instrument = program.instruments.get(key)

    if (events != null && instrument != null) {
      sequences.set(key, new Sequence<Step>({
        callback: createCallback(instrument, player),
        events,
        subdivision,
        loop: false
      }))
    }
  }

  return sequences
}

function createEvents (players: Map<InstrumentId, Player>, program: Program): Map<InstrumentId, Step[]> {
  const instrumentEvents = new Map<InstrumentId, Step[]>([
    ...Array.from(players.keys(), (id): [InstrumentId, Step[]] => [id, []])
  ])

  for (const section of program.track.sections) {
    const used = new Set<InstrumentId>()

    for (const routing of section.routings) {
      const player = players.get(routing.instrumentId)
      const events = instrumentEvents.get(routing.instrumentId)

      if (!used.has(routing.instrumentId) && player != null && events != null) {
        events.push(...withPatternLength(routing.pattern, section.length.value))
        used.add(routing.instrumentId)
      }
    }

    for (const [key, events] of instrumentEvents) {
      if (!used.has(key)) {
        events.push(...getSilentPattern(section.length.value))
      }
    }
  }

  return instrumentEvents
}

function createCallback (instrument: Instrument, player: Player): (time: number, note: Step) => void {
  return (time: number, note: Step) => {
    if (note === '-' || !player.loaded) {
      return
    }

    const rootNote = instrument.rootNote ?? DEFAULT_ROOT_NOTE
    player.playbackRate = isPitch(note) ? convertPitchToPlaybackRate(note, rootNote) : 1

    player.start(time, undefined, instrument.length?.value)
  }
}
