import type { Bus, BusId, Effect, Envelope, Instrument, InstrumentId, MidiNote, MixerRouting, Oscillator, Program, Sample, Track } from '@core'
import { beatsToSeconds, calculateTotalLength, convertPitchToMidi, renderPatternEvents, timeToSeconds } from '@core'
import type { Numeric } from '@utility'
import { numeric } from '@utility'
import { frequencyTransform, gainTransform, panTransform, timeVariant, toTimeVariant } from './automation.js'
import type { AudioGraphBuilder } from './builder.js'
import { createAudioGraphBuilder } from './builder.js'
import { DEFAULT_ROOT_NOTE } from './constants.js'
import type { EntityKey } from './entities.js'
import { createEntityKey } from './entities.js'
import type { AnyNode, AudioGraph, NodeId, NoteOptions } from './graph.js'
import type { BiquadNode, DelayNode, GainMeterNode, GainNode, IdentityNode, Node, OscillatorNode, PanNode, ReverbNode, SampleNode, WidthNode } from './nodes.js'

type Builder = AudioGraphBuilder<Node>

export interface AudioGraphOptions {
  /**
   * If specified, the graph will include additional nodes for metering with the given interval.
   * One node will be added for each instrument, bus, and the output.
   */
  readonly metering?: MeteringOptions
}

interface MeteringOptions {
  readonly interval: Numeric<'s'>
}

export function createAudioGraph (program: Program, options?: AudioGraphOptions): AudioGraph<Node> {
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

  if (options?.metering != null) {
    createMeteringNodes(busSubgraphs, instrumentSubgraphs, output.id, builder, options.metering)
  }

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

  // Optimization: Skip adding a node if the value is constant 0.
  // TODO: Make this more generic and move into appendEffect?
  if (bus.pan.initial.value !== 0 || program.automations.has(bus.pan.id)) {
    appendEffect({ type: 'pan', pan: bus.pan })
  }

  // TODO: see above
  if (bus.gain.initial.value !== 0 || program.automations.has(bus.gain.id)) {
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

  const envelope = (() => {
    const a = instrument.envelope.attack.value
    const d = instrument.envelope.decay.value
    const s = instrument.envelope.sustain.value
    const r = instrument.envelope.release.value

    const clampDuration = (value: number): Numeric<'s'> => {
      return Number.isFinite(value) && value >= 0
        ? numeric('s', value)
        : numeric('s', 0)
    }

    const clampSustain = (value: number): Numeric<undefined> => {
      return Number.isNaN(value)
        ? numeric(undefined, 0)
        : numeric(undefined, Math.max(0, Math.min(1, s)))
    }

    return {
      attack: clampDuration(a),
      decay: clampDuration(d),
      sustain: clampSustain(s),
      release: clampDuration(r)
    }
  })()

  const source = (() => {
    switch (instrument.source.type) {
      case 'sample':
        return createSampleSource(instrument.source, rootNote, envelope, builder)

      case 'oscillator':
        return createOscillatorSource(instrument.source, rootNote, envelope, builder)
    }
  })()

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

function createSampleSource (sample: Sample, rootNote: MidiNote, envelope: Envelope, builder: Builder): Node {
  const length = (() => {
    if (sample.length == null) {
      return undefined
    }

    const value = sample.length.value
    if (Number.isNaN(value)) {
      throw new Error(`Invalid length: ${value}`)
    }

    return value < 0 ? numeric('s', 0) : !Number.isFinite(value) ? undefined : numeric('s', value)
  })()

  return builder.addNode<SampleNode>('sample', { rootNote, envelope, url: sample.url, length })
}

function createOscillatorSource (oscillator: Oscillator, rootNote: MidiNote, envelope: Envelope, builder: Builder): Node {
  return builder.addNode<OscillatorNode>('oscillator', { rootNote, envelope, shape: oscillator.shape })
}

function createEffect (program: Program, effect: Effect, builder: Builder): SubGraph {
  switch (effect.type) {
    case 'gain': {
      return toSubGraph(builder.addNode<GainNode>('gain', {
        gain: toTimeVariant(effect.gain, program, gainTransform)
      }))
    }

    case 'pan': {
      return toSubGraph(builder.addNode<PanNode>('pan', {
        pan: toTimeVariant(effect.pan, program, panTransform)
      }))
    }

    case 'lowpass': {
      return toSubGraph(builder.addNode<BiquadNode>('biquad', {
        filterType: 'lowpass',
        frequency: toTimeVariant(effect.frequency, program, frequencyTransform),
        // TODO configurable rolloff
        rolloffPerOctave: numeric('db', 12)
      }))
    }

    case 'highpass': {
      return toSubGraph(builder.addNode<BiquadNode>('biquad', {
        filterType: 'highpass',
        frequency: toTimeVariant(effect.frequency, program, frequencyTransform),
        // TODO configurable rolloff
        rolloffPerOctave: numeric('db', 12)
      }))
    }

    case 'width': {
      if (Number.isNaN(effect.width.value)) {
        throw new Error(`Invalid width: ${effect.width.value}`)
      }

      return toSubGraph(builder.addNode<WidthNode>('width', {
        // TODO time variant
        width: numeric(undefined, Math.max(0, Math.min(1, effect.width.value)))
      }))
    }

    case 'delay': {
      if (Number.isNaN(effect.feedback.value)) {
        throw new Error(`Invalid feedback: ${effect.feedback.value}`)
      }

      if (!Number.isFinite(effect.time.value)) {
        throw new Error(`Invalid time: ${effect.time.value}`)
      }

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
      if (!Number.isFinite(effect.decay.value)) {
        throw new Error(`Invalid decay: ${effect.decay.value}`)
      }

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
  if (Number.isNaN(mix)) {
    throw new Error(`Invalid mix: ${mix}`)
  }

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
      case 'bus':
        return busSubgraphs.get(item.id)
      case 'instrument':
        return instrumentSubgraphs.get(item.id)
    }
  }

  const findDestination = (item: MixerRouting['destination']): SubGraph | undefined => {
    switch (item.type) {
      case 'output':
        return { inputs: [outputId], outputs: [outputId] }
      case 'bus':
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

function createMeteringNodes (
  busSubgraphs: ReadonlyMap<BusId, SubGraph>,
  instrumentSubgraphs: ReadonlyMap<InstrumentId, SubGraph>,
  outputId: NodeId,
  builder: Builder,
  options: MeteringOptions
): void {
  const intervalSeconds = options.interval.value
  if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
    throw new Error(`Invalid metering interval: ${options.interval.value}`)
  }

  const createMeters = (key: EntityKey, sources: readonly NodeId[]): void => {
    const gainMeter = builder.addNode<GainMeterNode>('gain_meter', {
      key,
      interval: options.interval
    })

    builder.addMeters(key, {
      gainMeterId: gainMeter.id
    })

    builder.addEdges(sources, [gainMeter.id])
  }

  {
    const key = createEntityKey({ type: 'output' })
    createMeters(key, [outputId])
  }

  for (const [busId, subgraph] of busSubgraphs) {
    const key = createEntityKey({ type: 'bus', id: busId })
    createMeters(key, subgraph.outputs)
  }

  for (const [instrumentId, subgraph] of instrumentSubgraphs) {
    const key = createEntityKey({ type: 'instrument', id: instrumentId })
    createMeters(key, subgraph.outputs)
  }
}
