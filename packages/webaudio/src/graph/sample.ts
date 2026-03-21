import type { NoteOptions } from '@audiograph/graph.js'
import type { SampleNode } from '@audiograph/nodes.js'
import { createMultimap } from '@collections/multimap.js'
import type { Pitch } from '@core/program.js'
import type { AudioFetcher } from '../assets/fetcher.js'
import { convertPitchToMidi } from '../midi.js'
import type { Transport } from '../transport.js'
import type { Instance } from './types.js'

export function createSampleInstance (node: SampleNode, transport: Transport, fetcher: AudioFetcher): Instance {
  const { ctx } = transport

  // declick
  const envelope = {
    attack: 0.005,
    release: 0.005
  }

  const rootNoteMidi = convertPitchToMidi(node.rootNote)
  const sourcesByMidi = createMultimap<number, ActiveSource>()

  const output = ctx.createGain()

  let sampleBuffer: AudioBuffer | undefined
  const loaded = fetcher.fetch(ctx, node.sampleUrl).then((buffer) => {
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

    const duration = (() => {
      if (options.duration == null || node.length == null) {
        return options.duration ?? node.length?.value
      }

      return Math.min(options.duration, node.length.value)
    })()

    if (duration != null && duration <= 0) {
      return
    }

    const midi = options.pitch != null ? asMidi(options.pitch) : rootNoteMidi
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

    if (duration != null) {
      const releaseStartTime = time + duration
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
