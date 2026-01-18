import { renderPatternEvents } from '@core/pattern.js'
import { Part } from 'tone'
import { makeNumeric, type Instrument, type InstrumentId, type NoteEvent, type Program } from '../program.js'
import { DEFAULT_ROOT_NOTE } from './constants.js'
import type { InstrumentInstance, PartInstance } from './instances.js'
import { beatsToSeconds } from './time.js'

export function createParts (
  program: Program,
  instruments: ReadonlyMap<InstrumentId, InstrumentInstance>
): readonly PartInstance[] {
  const noteEvents = createNoteEventMap(program)

  const result: PartInstance[] = []

  for (const [instrumentId, values] of noteEvents.entries()) {
    const instrument = program.instruments.get(instrumentId)
    const instance = instruments.get(instrumentId)

    if (instrument == null || instance == null) {
      continue
    }

    const callback = createInstrumentCallback(program, instrument, instance)
    const part = new Part(callback, values)

    result.push({
      loaded: Promise.resolve(),

      dispose: () => {
        part.stop().dispose()
      },

      start: (time) => {
        part.start(time)
      }
    })
  }

  return result
}

type NoteEventMap = ReadonlyMap<InstrumentId, Array<readonly [number, NoteEvent]>>
type InstrumentCallback = (time: number, event: NoteEvent) => void

const BEAT = makeNumeric('beats', 1)

function createNoteEventMap (program: Program): NoteEventMap {
  const timePerBeat = beatsToSeconds(BEAT, program.track.tempo).value

  const map = new Map<InstrumentId, Array<[number, NoteEvent]>>()

  let offsetBeats = 0

  for (const part of program.track.parts) {
    for (const routing of part.routings) {
      const patternEvents = renderPatternEvents(routing.source.value, part.length)
        .map((event): [number, NoteEvent] => {
          return [(offsetBeats + event.time.value) * timePerBeat, event]
        })

      const events = map.get(routing.destination.id)
      if (events == null) {
        map.set(routing.destination.id, patternEvents)
      } else {
        events.push(...patternEvents)
      }
    }

    offsetBeats += part.length.value
  }

  return map
}

function createInstrumentCallback (
  program: Program,
  instrument: Instrument,
  instance: InstrumentInstance
): InstrumentCallback {
  const timePerBeat = beatsToSeconds(BEAT, program.track.tempo).value
  const defaultNote = instrument.rootNote ?? DEFAULT_ROOT_NOTE

  return (time: number, event: NoteEvent) => {
    const note = event.pitch ?? defaultNote
    const duration = getNoteDuration(instrument, event, timePerBeat)

    if (duration == null) {
      instance.triggerAttack(note, time)
      return
    }

    if (duration > 0 && Number.isFinite(duration)) {
      instance.triggerAttack(note, time)
      instance.triggerRelease(note, time + duration)
    }
  }
}

function getNoteDuration (instrument: Instrument, event: NoteEvent, timePerBeat: number): number | undefined {
  const instrumentSeconds = instrument.length?.value
  const gateSeconds = event.gate != null ? event.gate.value * timePerBeat : undefined

  if (gateSeconds == null || instrumentSeconds == null) {
    return gateSeconds ?? instrumentSeconds
  }

  return Math.min(gateSeconds, instrumentSeconds)
}
