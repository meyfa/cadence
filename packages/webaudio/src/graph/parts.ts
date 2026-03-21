import { DEFAULT_ROOT_NOTE } from '@audiograph/constants.js'
import type { AudioGraph, NodeId } from '@audiograph/graph.js'
import type { Node } from '@audiograph/nodes.js'
import { numeric } from '@core/numeric.js'
import { renderPatternEvents } from '@core/pattern.js'
import { type Instrument, type NoteEvent, type Program } from '@core/program.js'
import { beatsToSeconds } from '@core/time.js'
import type { Instance } from './types.js'

export function scheduleNoteEvents (
  program: Program,
  graph: AudioGraph<Node>,
  instruments: Map<NodeId, Instance>
): void {
  const timePerBeat = beatsToSeconds(numeric('beats', 1), program.track.tempo).value

  let offsetBeats = 0

  for (const part of program.track.parts) {
    for (const routing of part.routings) {
      const instrument = program.instruments.get(routing.destination.id)
      const nodeId = graph.instruments.get(routing.destination.id)
      const instance = nodeId != null ? instruments.get(nodeId) : undefined

      if (instrument == null || instance?.triggerNote == null) {
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
