import { createMultimap } from '@collections/multimap.js'
import type { Instrument, InstrumentId, Pitch, Program } from '@core/program.js'
import { DEFAULT_ROOT_NOTE } from './constants.js'
import { dbToGain } from './conversion.js'
import type { InstrumentInstance, TriggerAttack, TriggerRelease } from './instances.js'
import { convertPitchToMidi } from './midi.js'

export function createInstruments (ctx: BaseAudioContext, program: Program): ReadonlyMap<InstrumentId, InstrumentInstance> {
  return new Map(
    [...program.instruments.values()].map((instrument) => [
      instrument.id,
      createInstrument(ctx, instrument)
    ])
  )
}

interface ActiveSource {
  readonly sourceNode: AudioBufferSourceNode
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

function createInstrument (ctx: BaseAudioContext, instrument: Instrument): InstrumentInstance {
  // declick
  const envelope = {
    attack: 0.005,
    release: 0.005
  }

  const rootNoteMidi = convertPitchToMidi(instrument.rootNote ?? DEFAULT_ROOT_NOTE)
  const sourcesByMidi = createMultimap<number, ActiveSource>()

  const output = ctx.createGain()
  output.gain.value = dbToGain(instrument.gain.initial.value)

  let sampleBuffer: AudioBuffer | undefined
  const loaded = loadSampleBuffer(ctx, instrument.sampleUrl).then((buffer) => {
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

  const triggerAttack: TriggerAttack = (note, time, velocity) => {
    if (sampleBuffer == null) {
      return
    }

    const midi = asMidi(note)
    const startTime = time ?? ctx.currentTime
    const volume = Math.max(0, Math.min(1, velocity ?? 1))

    const sourceNode = ctx.createBufferSource()
    const gainNode = ctx.createGain()

    const source: ActiveSource = { sourceNode, gainNode, disposed: false }
    sourcesByMidi.add(midi, source)

    sourceNode.addEventListener('ended', () => {
      if (!source.disposed) {
        sourcesByMidi.delete(midi, source)
        disposeActiveSource(source)
      }
    }, { once: true })

    sourceNode.buffer = sampleBuffer
    sourceNode.playbackRate.value = Math.pow(2, (midi - rootNoteMidi) / 12)

    gainNode.gain.setValueAtTime(0, startTime)
    gainNode.gain.linearRampToValueAtTime(volume, startTime + envelope.attack)

    sourceNode.connect(gainNode).connect(output)
    sourceNode.start(startTime)
  }

  const triggerRelease: TriggerRelease = (note, time) => {
    const sources = sourcesByMidi.get(asMidi(note))
    if (sources == null) {
      return
    }

    for (const { sourceNode, gainNode } of sources) {
      const releaseStartTime = time ?? ctx.currentTime
      const releaseEndTime = releaseStartTime + envelope.release

      // TODO: get actual value at time
      const currentGain = gainNode.gain.value
      gainNode.gain.setValueAtTime(currentGain, releaseStartTime)
      gainNode.gain.linearRampToValueAtTime(0, releaseEndTime)

      sourceNode.stop(releaseEndTime)
    }
  }

  return {
    output,
    loaded,
    dispose,
    triggerAttack,
    triggerRelease
  }
}

function asMidi (note: Pitch | number): number {
  return typeof note === 'number' ? note : convertPitchToMidi(note)
}

async function loadSampleBuffer (ctx: BaseAudioContext, url: string | URL): Promise<AudioBuffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load sample: ${response.status} ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()

  return await ctx.decodeAudioData(arrayBuffer)
}
