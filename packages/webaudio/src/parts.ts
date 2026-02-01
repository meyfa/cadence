import { createMultimap, type ReadonlyMultimap } from '@collections/multimap.js'
import { renderPatternEvents } from '@core/pattern.js'
import { makeNumeric, type Instrument, type InstrumentId, type NoteEvent, type Program } from '@core/program.js'
import { beatsToSeconds } from '@core/time.js'
import { DEFAULT_ROOT_NOTE } from './constants.js'
import type { InstrumentInstance } from './instances.js'

export function scheduleNoteEvents (
  program: Program,
  instruments: ReadonlyMap<InstrumentId, InstrumentInstance>
): void {
  const noteEvents = createNoteEventMap(program)

  for (const [instrumentId, values] of noteEvents.entries()) {
    const instrument = program.instruments.get(instrumentId)
    const instance = instruments.get(instrumentId)

    if (instrument == null || instance == null) {
      continue
    }

    const timePerBeat = beatsToSeconds(BEAT, program.track.tempo).value
    const defaultNote = instrument.rootNote ?? DEFAULT_ROOT_NOTE

    for (const { time, event } of values) {
      const note = event.pitch ?? defaultNote
      const duration = getNoteDuration(instrument, event, timePerBeat)
      const velocity = 1.0

      if (duration == null) {
        instance.triggerNote({ note, time, velocity })
        continue
      }

      if (duration > 0 && Number.isFinite(duration)) {
        instance.triggerNote({ note, time, velocity, duration })
      }
    }
  }
}

interface NoteEventEntry {
  readonly time: number
  readonly event: NoteEvent
}

type NoteEventMap = ReadonlyMultimap<InstrumentId, NoteEventEntry>

const BEAT = makeNumeric('beats', 1)

function createNoteEventMap (program: Program): NoteEventMap {
  const map = createMultimap<InstrumentId, NoteEventEntry>()

  const timePerBeat = beatsToSeconds(BEAT, program.track.tempo).value
  let offsetBeats = 0

  for (const part of program.track.parts) {
    for (const routing of part.routings) {
      const patternEvents = renderPatternEvents(routing.source.value, part.length)
        .map((event) => ({ event, time: (offsetBeats + event.time.value) * timePerBeat }))

      map.add(routing.destination.id, ...patternEvents)
    }

    offsetBeats += part.length.value
  }

  return map
}

function getNoteDuration (instrument: Instrument, event: NoteEvent, timePerBeat: number): number | undefined {
  const instrumentSeconds = instrument.length?.value
  const gateSeconds = event.gate != null ? event.gate.value * timePerBeat : undefined

  if (gateSeconds == null || instrumentSeconds == null) {
    return gateSeconds ?? instrumentSeconds
  }

  return Math.min(gateSeconds, instrumentSeconds)
}
