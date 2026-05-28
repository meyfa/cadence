import type { NoteOptions } from '@audiograph'
import type { MidiNote } from '@core'
import type { Numeric } from '@utility'
import { createMultimap } from '@utility'
import type { Transport } from '../../transport/transport.js'
import type { Instance } from '../instance.js'

export type CreateSource = (note: NoteOptions) => AudioScheduledSourceNode

export interface InstrumentOptions {
  readonly rootNote: MidiNote
  readonly length?: Numeric<'s'>
}

export function createInstrumentInstance (transport: Transport, createSource: CreateSource, options: InstrumentOptions): Instance {
  const { ctx } = transport

  // declick
  const envelope = {
    attack: 0.005,
    release: 0.005
  }

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

    const duration = (() => {
      if (note.duration == null || options.length == null) {
        return note.duration ?? options.length?.value
      }

      return Math.min(note.duration, options.length.value)
    })()

    if (duration != null && duration <= 0) {
      return
    }

    const midi = note.pitch ?? options.rootNote
    const targetGain = Math.max(0, Math.min(1, note.velocity))

    const sourceNode = createSource(note)
    const gainNode = ctx.createGain()

    const source: ActiveSource = {
      sourceNode,
      gainNode,
      targetGain,
      disposed: false
    }
    sourcesByMidi.add(midi, source)

    sourceNode.addEventListener('ended', () => {
      if (!source.disposed) {
        sourcesByMidi.delete(midi, source)
        disposeActiveSource(source)
      }
    }, { once: true })

    gainNode.gain.setValueAtTime(0, time)
    gainNode.gain.linearRampToValueAtTime(targetGain, time + envelope.attack)

    sourceNode.connect(gainNode).connect(output)
    sourceNode.start(time)

    if (duration != null) {
      const releaseStartTime = time + duration
      const releaseEndTime = releaseStartTime + envelope.release

      gainNode.gain.setValueAtTime(targetGain, releaseStartTime)
      gainNode.gain.linearRampToValueAtTime(0, releaseEndTime)

      sourceNode.stop(releaseEndTime)
    }
  })

  return { dispose, output, triggerNote }
}

interface ActiveSource {
  readonly sourceNode: AudioScheduledSourceNode
  readonly gainNode: GainNode
  readonly targetGain: number
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
