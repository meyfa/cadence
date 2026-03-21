import { createMultimap } from '@collections/multimap.js'
import type { Instrument, Pitch, Program } from '@core/program.js'
import type { AudioFetcher } from '../assets/fetcher.js'
import { automate } from '../automation.js'
import { DEFAULT_ROOT_NOTE } from '../constants.js'
import { convertPitchToMidi } from '../midi.js'
import type { Transport } from '../transport.js'
import type { Instance, NoteOptions } from './types.js'

export function createSampleInstrument (program: Program, instrument: Instrument, transport: Transport, fetcher: AudioFetcher): Instance {
  const { ctx } = transport

  // declick
  const envelope = {
    attack: 0.005,
    release: 0.005
  }

  const rootNoteMidi = convertPitchToMidi(instrument.rootNote ?? DEFAULT_ROOT_NOTE)
  const sourcesByMidi = createMultimap<number, ActiveSource>()

  const output = ctx.createGain()

  automate(transport, output.gain, 'gain', program, instrument.gain)

  let sampleBuffer: AudioBuffer | undefined
  const loaded = fetcher.fetch(ctx, instrument.sampleUrl).then((buffer) => {
    sampleBuffer = buffer
  })

  const dispose = () => {
    output.disconnect()
    for (const sources of sourcesByMidi.values()) {
      for (const source of sources) {
        disposeActiveSource(source)
      }
    }
  }

  const triggerNote = (options: NoteOptions) => transport.schedule(options.time, (time) => {
    if (sampleBuffer == null || time < 0) {
      return
    }

    if (options.duration != null && options.duration <= 0) {
      return
    }

    const midi = asMidi(options.note)
    const targetGain = Math.max(0, Math.min(1, options.velocity))

    const sourceNode = ctx.createBufferSource()
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

    sourceNode.buffer = sampleBuffer
    sourceNode.playbackRate.value = Math.pow(2, (midi - rootNoteMidi) / 12)

    gainNode.gain.setValueAtTime(0, time)
    gainNode.gain.linearRampToValueAtTime(targetGain, time + envelope.attack)

    sourceNode.connect(gainNode).connect(output)
    sourceNode.start(time)

    if (options.duration != null) {
      const releaseStartTime = time + options.duration
      const releaseEndTime = releaseStartTime + envelope.release

      gainNode.gain.setValueAtTime(targetGain, releaseStartTime)
      gainNode.gain.linearRampToValueAtTime(0, releaseEndTime)

      sourceNode.stop(releaseEndTime)
    }
  })

  return {
    loaded,
    dispose,
    output,
    triggerNote
  }
}

interface ActiveSource {
  readonly sourceNode: AudioBufferSourceNode
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

function asMidi (note: Pitch | number): number {
  return typeof note === 'number' ? note : convertPitchToMidi(note)
}
