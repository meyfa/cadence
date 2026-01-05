import { renderPatternEvents } from '@core/pattern.js'
import { Part, type Sampler } from 'tone'
import { makeNumeric, type Instrument, type InstrumentId, type NoteEvent, type Program } from '../program.js'
import { DEFAULT_ROOT_NOTE } from './constants.js'
import { beatsToSeconds } from './time.js'

const BEAT = makeNumeric('beats', 1)

export function createParts (program: Program, players: Map<InstrumentId, Sampler>): readonly Part[] {
  const eventsByInstrument = new Map<InstrumentId, Array<[number, NoteEvent]>>()

  const timePerBeat = beatsToSeconds(BEAT, program.track.tempo).value
  let currentOffsetBeats = 0

  for (const section of program.track.sections) {
    const startOffset = currentOffsetBeats * timePerBeat
    currentOffsetBeats += section.length.value

    for (const routing of section.routings) {
      const events = renderPatternEvents(routing.source.value, section.length)
      const values: Array<[number, NoteEvent]> = events.map((event) => [
        startOffset + event.time.value * timePerBeat,
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

    result.push(new Part(createCallback(instrument, player, timePerBeat), values))
  }

  return result
}

type PlayerCallback = (time: number, event: NoteEvent) => void

function createCallback (instrument: Instrument, player: Sampler, timePerBeat: number): PlayerCallback {
  const instrumentLength = instrument.length?.value

  return (time: number, event: NoteEvent) => {
    if (!player.loaded) {
      return
    }

    const note = event.pitch ?? instrument.rootNote ?? DEFAULT_ROOT_NOTE

    const gateSeconds = event.gate != null ? event.gate.value * timePerBeat : undefined
    const duration = gateSeconds != null && instrumentLength != null
      ? Math.min(gateSeconds, instrumentLength)
      : (gateSeconds ?? instrumentLength)

    if (duration == null) {
      player.triggerAttack(note, time)
      return
    }

    player.triggerAttackRelease(note, duration, time)
  }
}
