import { renderPatternEvents } from '@core/pattern.js'
import { Part, Player } from 'tone'
import { convertPitchToPlaybackRate } from '../midi.js'
import { makeNumeric, type Instrument, type InstrumentId, type NoteEvent, type Program } from '../program.js'
import { stepsToSeconds } from './time.js'

export const DEFAULT_ROOT_NOTE = 'C5' as const

const STEP = makeNumeric('steps', 1)

export function createParts (program: Program, players: Map<InstrumentId, Player>): readonly Part[] {
  const eventsByInstrument = new Map<InstrumentId, Array<[number, NoteEvent]>>()

  const timePerStep = stepsToSeconds(STEP, program.track.tempo, program.stepsPerBeat).value
  let currentOffsetSteps = 0

  for (const section of program.track.sections) {
    const startOffset = currentOffsetSteps * timePerStep
    currentOffsetSteps += section.length.value

    for (const routing of section.routings) {
      const events = renderPatternEvents(routing.source.value, section.length)
      const values: Array<[number, NoteEvent]> = events.map((event) => [
        startOffset + event.time.value * timePerStep,
        event
      ])

      const instrumentEvents = eventsByInstrument.get(routing.destination.id)
      if (instrumentEvents == null) {
        eventsByInstrument.set(routing.destination.id, values)
        continue
      }

      instrumentEvents.push(...values)
    }
  }

  const result: Part[] = []

  for (const [instrumentId, values] of eventsByInstrument.entries()) {
    const instrument = program.instruments.get(instrumentId)
    const player = players.get(instrumentId)
    if (instrument == null || player == null) {
      continue
    }

    result.push(new Part(createCallback(instrument, player), values))
  }

  return result
}

function createCallback (instrument: Instrument, player: Player): (time: number, event: NoteEvent) => void {
  const duration = instrument.length?.value

  return (time: number, event: NoteEvent) => {
    if (!player.loaded) {
      return
    }

    const rootNote = instrument.rootNote ?? DEFAULT_ROOT_NOTE
    const playbackRate = event.pitch != null ? convertPitchToPlaybackRate(event.pitch, rootNote) : 1

    player.playbackRate = playbackRate
    player.start(time, undefined, duration)
  }
}
