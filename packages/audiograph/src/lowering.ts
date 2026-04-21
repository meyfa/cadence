import type { Bus, BusId, Effect, Instrument, InstrumentId, MixerRouting, Program, Track } from '@core'
import { beatsToSeconds, calculateTotalLength, convertPitchToMidi, renderPatternEvents, timeToSeconds } from '@core'
import { numeric } from '@utility'
import { gainTransform, timeVariant, toTimeVariant } from './automation.js'
import { createAudioGraphBuilder, type AudioGraphBuilder } from './builder.js'
import { dbToGain, DEFAULT_ROOT_NOTE } from './constants.js'
import type { AnyNode, AudioGraph, NodeId, NoteOptions } from './graph.js'
import type { BiquadNode, DelayNode, GainNode, IdentityNode, Node, PanNode, ReverbNode, SampleNode, WidthNode } from './nodes.js'

type Builder = AudioGraphBuilder<Node>

export function createAudioGraph (program: Program): AudioGraph<Node> {
  const builder = createAudioGraphBuilder<Node>({
    tempo: program.track.tempo,
    length: calculateTotalLength(program)
  })

  const output = builder.addNode<IdentityNode>('identity', {})
  builder.setOutput(output.id)

  const busSubgraphs = new Map<BusId, SubGraph>()
  const instrumentSubgraphs = new Map<InstrumentId, SubGraph>()
  const instruments = new Map<InstrumentId, NodeId>()

  for (const bus of program.mixer.buses) {
    busSubgraphs.set(bus.id, createBus(program, bus, builder))
  }

  for (const instrument of program.instruments.values()) {
    const result = createInstrument(program, instrument, builder)
    instrumentSubgraphs.set(instrument.id, result)
    if (result.instrument != null) {
      instruments.set(instrument.id, result.instrument)
    }
  }

  createRoutings(program, busSubgraphs, instrumentSubgraphs, output.id, builder)

  createNoteEvents(program.track, instruments, builder)

  return builder.graph()
}

interface SubGraph {
  readonly inputs: readonly NodeId[]
  readonly outputs: readonly NodeId[]
  readonly instrument?: NodeId
}

function toSubGraph (node: AnyNode): SubGraph {
  return {
    inputs: [node.id],
    outputs: [node.id]
  }
}

function createBus (program: Program, bus: Bus, builder: Builder): SubGraph {
  const effectSubgraphs: SubGraph[] = []

  const appendEffect = (effect: Effect) => {
    const previousOutputs = effectSubgraphs.at(-1)?.outputs ?? []
    const subgraph = createEffect(program, effect, builder)
    effectSubgraphs.push(subgraph)
    builder.addEdges(previousOutputs, subgraph.inputs)
  }

  for (const effect of bus.effects) {
    appendEffect(effect)
  }

  if (bus.pan != null) {
    appendEffect({ type: 'pan', pan: bus.pan })
  }

  if (bus.gain != null) {
    appendEffect({ type: 'gain', gain: bus.gain })
  }

  const first = effectSubgraphs.at(0)
  const last = effectSubgraphs.at(-1)

  if (first == null || last == null) {
    const throughNode = builder.addNode<IdentityNode>('identity', {})
    return {
      inputs: [throughNode.id],
      outputs: [throughNode.id]
    }
  }

  return {
    inputs: first.inputs,
    outputs: last.outputs
  }
}

function createInstrument (program: Program, instrument: Instrument, builder: Builder): SubGraph {
  const rootNote = instrument.rootNote != null
    ? convertPitchToMidi(instrument.rootNote)
    : DEFAULT_ROOT_NOTE

  const source = builder.addNode<SampleNode>('sample', {
    sampleUrl: instrument.sampleUrl,
    rootNote,
    length: instrument.length
  })

  const gain = builder.addNode<GainNode>('gain', {
    gain: toTimeVariant(instrument.gain, program, gainTransform)
  })

  builder.addEdge(source.id, gain.id)

  return {
    inputs: [source.id],
    outputs: [gain.id],
    instrument: source.id
  }
}

function createEffect (program: Program, effect: Effect, builder: Builder): SubGraph {
  switch (effect.type) {
    case 'gain': {
      return toSubGraph(builder.addNode<GainNode>('gain', {
        // TODO time variant
        gain: timeVariant(numeric(undefined, dbToGain(effect.gain.value)), [])
      }))
    }

    case 'pan': {
      return toSubGraph(builder.addNode<PanNode>('pan', {
        // TODO time variant
        pan: numeric(undefined, Math.max(-1, Math.min(1, effect.pan.value)))
      }))
    }

    case 'lowpass': {
      return toSubGraph(builder.addNode<BiquadNode>('biquad', {
        filterType: 'lowpass',
        // TODO time variant
        frequency: effect.frequency,
        // TODO configurable rolloff
        rolloffPerOctave: numeric('db', 12)
      }))
    }

    case 'highpass': {
      return toSubGraph(builder.addNode<BiquadNode>('biquad', {
        filterType: 'highpass',
        // TODO time variant
        frequency: effect.frequency,
        // TODO configurable rolloff
        rolloffPerOctave: numeric('db', 12)
      }))
    }

    case 'width': {
      return toSubGraph(builder.addNode<WidthNode>('width', {
        // TODO time variant
        width: numeric(undefined, Math.max(0, Math.min(1, effect.width.value)))
      }))
    }

    case 'delay': {
      const delayNode = builder.addNode<DelayNode>('delay', {
        // TODO time variant
        time: timeToSeconds(effect.time, program.track.tempo)
      })

      if (effect.feedback.value > 0) {
        const feedback = numeric(undefined, Math.min(1.0, effect.feedback.value))

        const feedbackGain = builder.addNode<GainNode>('gain', {
          // TODO time variant
          gain: timeVariant(feedback, [])
        })

        builder.addEdge(delayNode.id, feedbackGain.id)
        builder.addEdge(feedbackGain.id, delayNode.id)
      }

      return createDryWetMix(delayNode, effect.mix.value, builder)
    }

    case 'reverb': {
      const mix = Math.max(0, Math.min(1, effect.mix.value))
      if (mix <= 0) {
        return toSubGraph(builder.addNode<IdentityNode>('identity', {}))
      }

      const reverb = builder.addNode<ReverbNode>('reverb', {
        // TODO time variant
        decay: timeToSeconds(effect.decay, program.track.tempo)
      })

      return createDryWetMix(reverb, mix, builder)
    }
  }
}

function createDryWetMix (effect: Node, mix: number, builder: Builder): SubGraph {
  if (mix <= 0) {
    return toSubGraph(builder.addNode<IdentityNode>('identity', {}))
  }

  if (mix >= 1) {
    return toSubGraph(effect)
  }

  // dry: 0.0...0.5 -> 100%,   0.75: 50%,         1.0:   0%
  // wet:       0.0 ->   0%,   0.25: 50%,   0.5...1.0: 100%

  const dry = Math.max(0, Math.min(1, (1 - mix) * 2))
  const dryNode = builder.addNode<GainNode>('gain', {
    gain: timeVariant(numeric(undefined, dry), [])
  })

  const wet = Math.max(0, Math.min(1, mix * 2))
  const wetNode = builder.addNode<GainNode>('gain', {
    gain: timeVariant(numeric(undefined, wet), [])
  })

  builder.addEdge(effect.id, wetNode.id)

  return {
    inputs: [dryNode.id, effect.id],
    outputs: [dryNode.id, wetNode.id]
  }
}

function createRoutings (
  program: Program,
  busSubgraphs: ReadonlyMap<BusId, SubGraph>,
  instrumentSubgraphs: ReadonlyMap<InstrumentId, SubGraph>,
  outputId: NodeId,
  builder: Builder
): void {
  const findSource = (item: MixerRouting['source']): SubGraph | undefined => {
    switch (item.type) {
      case 'Bus':
        return busSubgraphs.get(item.id)
      case 'Instrument':
        return instrumentSubgraphs.get(item.id)
    }
  }

  const findDestination = (item: MixerRouting['destination']): SubGraph | undefined => {
    switch (item.type) {
      case 'Output':
        return { inputs: [outputId], outputs: [outputId] }
      case 'Bus':
        return busSubgraphs.get(item.id)
    }
  }

  for (const routing of program.mixer.routings) {
    const source = findSource(routing.source)
    const destination = findDestination(routing.destination)
    if (source != null && destination != null) {
      builder.addEdges(source.outputs, destination.inputs)
    }
  }
}

function createNoteEvents (track: Track, instruments: ReadonlyMap<InstrumentId, NodeId>, builder: Builder): void {
  const timePerBeat = beatsToSeconds(numeric('beats', 1), track.tempo).value

  let offsetBeats = 0

  for (const part of track.parts) {
    for (const routing of part.routings) {
      const nodeId = instruments.get(routing.destination.id)
      if (nodeId == null) {
        continue
      }

      const events: readonly NoteOptions[] = renderPatternEvents(routing.source.value, part.length).map((event) => ({
        time: (offsetBeats + event.time.value) * timePerBeat,
        pitch: event.pitch != null ? convertPitchToMidi(event.pitch) : undefined,
        // TODO custom velocity
        velocity: 1.0,
        duration: event.gate != null ? event.gate.value * timePerBeat : undefined
      }))

      builder.addNoteEvents(nodeId, events)
    }

    offsetBeats += part.length.value
  }
}
