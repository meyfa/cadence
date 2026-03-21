import { numeric, type Numeric, type Unit } from '@core/numeric.js'
import type { Automation, Bus, BusId, Effect, Instrument, InstrumentId, MixerRouting, Parameter, Program } from '@core/program.js'
import { beatsToSeconds } from '@core/time.js'
import { createAudioGraphBuilder, type AudioGraphBuilder } from './builder.js'
import { dbToGain, DEFAULT_ROOT_NOTE } from './constants.js'
import type { AudioGraph, Node, NodeId } from './graph.js'
import { SampleNode, type GainNode, type IdentityNode } from './nodes.js'
import { timeVariant, type TimeVariant } from './timevariant.js'

export function createAudioGraph (program: Program): AudioGraph {
  const builder = createAudioGraphBuilder()

  const output = builder.addNode<IdentityNode>('identity', {})
  builder.addOutput(output.id)

  const busSubgraphs = new Map<BusId, SubGraph>()
  const instrumentSubgraphs = new Map<InstrumentId, SubGraph>()

  for (const bus of program.mixer.buses) {
    busSubgraphs.set(bus.id, createBus(program, bus, builder))
  }

  for (const instrument of program.instruments.values()) {
    instrumentSubgraphs.set(instrument.id, createInstrument(program, instrument, builder))
  }

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
        return { inputs: [output.id], outputs: [output.id] }
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

  return builder.graph()
}

interface SubGraph {
  readonly inputs: readonly NodeId[]
  readonly outputs: readonly NodeId[]
}

function toSubGraph (node: Node): SubGraph {
  return {
    inputs: [node.id],
    outputs: [node.id]
  }
}

function toTimeVariant<FromUnit extends Unit, ToUnit extends Unit> (
  parameter: Parameter<FromUnit>,
  program: Program,
  mapFn: (value: Numeric<FromUnit>) => Numeric<ToUnit>
): TimeVariant<ToUnit> {
  const initial = mapFn(parameter.initial)

  const automation = program.automations.get(parameter.id)
  if (automation == null) {
    return timeVariant<ToUnit>(initial, [])
  }

  const points = (automation as Automation<FromUnit>).points.map((point) => ({
    time: beatsToSeconds(point.time, program.track.tempo),
    value: mapFn(point.value),
    curve: point.curve
  }))

  return timeVariant<ToUnit>(initial, points)
}

function mapGain ({ value }: Numeric<'db'>): Numeric<undefined> {
  return numeric(undefined, dbToGain(value))
}

function createBus (program: Program, bus: Bus, builder: AudioGraphBuilder): SubGraph {
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

function createInstrument (program: Program, instrument: Instrument, builder: AudioGraphBuilder): SubGraph {
  const rootNote = instrument.rootNote ?? DEFAULT_ROOT_NOTE

  const source = builder.addNode<SampleNode>('sample', {
    sampleUrl: instrument.sampleUrl,
    rootNote,
    length: instrument.length
  })

  const gain = builder.addNode<GainNode>('gain', {
    gain: toTimeVariant(instrument.gain, program, mapGain)
  })

  builder.addEdge(source.id, gain.id)

  return {
    inputs: [source.id],
    outputs: [gain.id]
  }
}

function createEffect (program: Program, effect: Effect, builder: AudioGraphBuilder): SubGraph {
  switch (effect.type) {
    case 'gain': {
      return toSubGraph(builder.addNode<GainNode>('gain', {
        // TODO time variant
        gain: timeVariant(mapGain(effect.gain), [])
      }))
    }

    case 'pan': {
      return toSubGraph(builder.addNode('pan', {
        // TODO time variant
        pan: Math.max(-1, Math.min(1, effect.pan.value))
      }))
    }

    case 'lowpass': {
      return toSubGraph(builder.addNode('lowpass', {
        // TODO time variant
        frequency: effect.frequency
      }))
    }

    case 'highpass': {
      return toSubGraph(builder.addNode('highpass', {
        // TODO time variant
        frequency: effect.frequency
      }))
    }

    case 'delay': {
      const mix = Math.max(0, Math.min(1, effect.mix.value))
      if (mix <= 0) {
        return toSubGraph(builder.addNode<IdentityNode>('identity', {}))
      }

      const delayNode = builder.addNode('delay', {
        // TODO time variant
        time: beatsToSeconds(effect.time, program.track.tempo)
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

      const dry = builder.addNode<GainNode>('gain', {
        gain: timeVariant(numeric(undefined, 1 - mix), [])
      })

      const wet = builder.addNode<GainNode>('gain', {
        gain: timeVariant(numeric(undefined, mix), [])
      })

      builder.addEdge(delayNode.id, wet.id)

      return {
        inputs: [dry.id, delayNode.id],
        outputs: [dry.id, wet.id]
      }
    }

    case 'reverb': {
      const mix = Math.max(0, Math.min(1, effect.mix.value))
      if (mix <= 0) {
        return toSubGraph(builder.addNode<IdentityNode>('identity', {}))
      }

      const reverb = builder.addNode('reverb', {
        // TODO time variant
        decay: effect.decay
      })

      const dry = builder.addNode<GainNode>('gain', {
        gain: timeVariant(numeric(undefined, 1 - mix), [])
      })

      const wet = builder.addNode<GainNode>('gain', {
        gain: timeVariant(numeric(undefined, mix), [])
      })

      builder.addEdge(reverb.id, wet.id)

      return {
        inputs: [dry.id, reverb.id],
        outputs: [dry.id, wet.id]
      }
    }
  }
}
