import type { NoteOptions, TimeVariant } from '@audiograph'
import type { MidiNote } from '@core'
import type { Numeric } from '@utility'
import { createMultimap } from '@utility'
import type { Transport } from '../../transport/transport.js'
import { applyAutomationPoints } from '../automation.js'
import type { Instance } from '../instance.js'

export type CreateSource = (note: NoteOptions) => AudioScheduledSourceNode

export interface InstrumentOptions {
  readonly envelope: (note: Pick<NoteOptions, 'duration' | 'velocity'>) => TimeVariant<undefined>
  readonly rootNote: MidiNote
  readonly length?: Numeric<'s'>
}

export function createInstrumentInstance (
  transport: Transport,
  createSource: CreateSource,
  options: InstrumentOptions
): Instance {
  const { ctx } = transport

  const sourcesByMidi = createMultimap<MidiNote, ActiveSource>()
  const output = ctx.createGain()

  const dispose = () => {
    output.disconnect()
    for (const sources of sourcesByMidi.values()) {
      for (const source of sources) {
        disposeActiveSource(source)
      }
    }
  }

  const triggerNote = (note: NoteOptions) => transport.schedule(note.time, (time) => {
    if (time < 0) {
      return
    }

    const holdDuration = (() => {
      if (note.duration == null || options.length == null) {
        return note.duration ?? options.length?.value
      }

      return Math.min(note.duration, options.length.value)
    })()

    const midi = note.pitch ?? options.rootNote
    const velocity = Math.max(0, Math.min(1, note.velocity))

    const sourceNode = createSource(note)
    const gainNode = ctx.createGain()

    sourceNode.connect(gainNode).connect(output)

    const source: ActiveSource = {
      sourceNode,
      gainNode,
      disposed: false
    }
    sourcesByMidi.add(midi, source)

    sourceNode.addEventListener('ended', () => {
      if (!source.disposed) {
        sourcesByMidi.delete(midi, source)
        disposeActiveSource(source)
      }
    }, { once: true })

    const { envelope } = options

    const noteEnvelope = envelope({ velocity, duration: holdDuration })
    applyAutomationPoints(time, transport, gainNode.gain, noteEnvelope)

    sourceNode.start(time)

    const lastPoint = noteEnvelope.points.at(-1)
    if (holdDuration != null && lastPoint != null) {
      sourceNode.stop(time + lastPoint.time.value)
    }
  })

  return { dispose, output, triggerNote }
}

interface ActiveSource {
  readonly sourceNode: AudioScheduledSourceNode
  readonly gainNode: GainNode
  disposed: boolean
}

function disposeActiveSource (source: ActiveSource): void {
  if (!source.disposed) {
    source.disposed = true
    source.sourceNode.stop()
    source.sourceNode.disconnect()
    source.gainNode.disconnect()
  }
}
