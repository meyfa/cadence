import { renderPatternEvents } from '@core/pattern.js'
import { makeNumeric, type Instrument, type InstrumentId, type NoteEvent, type Program } from '@core/program.js'
import { beatsToSeconds } from '@core/time.js'
import { DEFAULT_ROOT_NOTE } from './constants.js'
import type { InstrumentInstance } from './instances.js'

const BEAT = makeNumeric('beats', 1)

export function scheduleNoteEvents (
  program: Program,
  instruments: ReadonlyMap<InstrumentId, InstrumentInstance>
): void {
  const timePerBeat = beatsToSeconds(BEAT, program.track.tempo).value

  let offsetBeats = 0

  for (const part of program.track.parts) {
    for (const routing of part.routings) {
      const instrument = program.instruments.get(routing.destination.id)
      const instance = instruments.get(routing.destination.id)

      if (instrument == null || instance == null) {
        continue
      }

      for (const event of renderPatternEvents(routing.source.value, part.length)) {
        const time = (offsetBeats + event.time.value) * timePerBeat

        const note = event.pitch ?? instrument.rootNote ?? DEFAULT_ROOT_NOTE
        const duration = getNoteDuration(instrument, event, timePerBeat)
        const velocity = 1.0

        instance.triggerNote({ note, time, velocity, duration })
      }
    }

    offsetBeats += part.length.value
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
