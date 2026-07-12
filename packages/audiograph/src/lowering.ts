import type { Bus, BusId, Effect, Instrument, InstrumentId, MixerRouting, Oscillator, Program, Sample, Track, Voice } from '@core'
import { calculateTotalLength, dbToGain, renderPatternEvents, timeToSeconds } from '@core'
import type { Numeric } from '@utility'
import { runtimeNumeric } from '@utility'
import { computeParameterCurve, feedbackTransform, frequencyTransform, gainTransform, panTransform, transformCurve } from './automation.js'
import type { AudioGraphBuilder } from './builder.js'
import { createAudioGraphBuilder } from './builder.js'
import type { EntityKey } from './entities.js'
import { createEntityKey } from './entities.js'
import type { AudioGraph, NodeId } from './graph.js'
import type { BiquadNode, DelayNode, GainMeterNode, GainNode, IdentityNode, InstrumentNode, Node, PanNode, ReverbNode, SourceNode, WaveShaperNode, WidthNode } from './nodes.js'

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
    tempo: program.track.tempo.value,
    length: calculateTotalLength(program)
  })

  const outputId = builder.addNode<IdentityNode>('identity', {})
  builder.setOutput(outputId)

  for (const asset of program.assets.values()) {
    builder.addAsset(asset)
  }

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

  createRoutings(program, busSubgraphs, instrumentSubgraphs, outputId, builder)

  createNoteEvents(program.track, instruments, builder)

  if (options?.metering != null) {
    createMeteringNodes(busSubgraphs, instrumentSubgraphs, outputId, builder, options.metering)
  }

  return builder.graph()
}

interface SubGraph {
  readonly inputs: readonly NodeId[]
  readonly outputs: readonly NodeId[]
  readonly instrument?: NodeId
}

function toSubGraph (nodeId: NodeId): SubGraph {
  return {
    inputs: [nodeId],
    outputs: [nodeId]
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
    return toSubGraph(builder.addNode<IdentityNode>('identity', {}))
  }

  return {
    inputs: first.inputs,
    outputs: last.outputs
  }
}

function createInstrument (program: Program, instrument: Instrument, builder: Builder): SubGraph {
  const instrumentNodeId = builder.addNode<InstrumentNode>('instrument', {
    trigger: (note) => {
      const result: SourceNode[] = []

      for (const voice of instrument.trigger(note, program.track.tempo)) {
        if (voice.duration == null || voice.duration.value > 0) {
          result.push(createSourceNode(voice))
        }
      }

      return result
    }
  })

  const gainId = builder.addNode<GainNode>('gain', {
    gain: computeParameterCurve(instrument.gain, program, gainTransform)
  })

  builder.addEdge(instrumentNodeId, gainId)

  return {
    inputs: [instrumentNodeId],
    outputs: [gainId],
    instrument: instrumentNodeId
  }
}

function createSourceNode (voice: Voice): SourceNode {
  switch (voice.source.type) {
    case 'sample':
      return createSampleSourceNode(voice as Voice<Sample>)

    case 'oscillator':
      return createOscillatorSourceNode(voice as Voice<Oscillator>)
  }
}

function createSampleSourceNode (voice: Voice<Sample>): SourceNode {
  const { assetId, playbackRate } = voice.source

  if (playbackRate.value <= 0 || !Number.isFinite(playbackRate.value)) {
    throw new Error(`Invalid playback rate`)
  }

  return {
    type: 'sample',
    gainCurve: transformCurve(voice.envelope, gainTransform),
    duration: voice.duration?.value,
    assetId,
    playbackRate: playbackRate.value
  }
}

function createOscillatorSourceNode (voice: Voice<Oscillator>): SourceNode {
  const { shape, frequency } = voice.source

  if (frequency.value <= 0 || !Number.isFinite(frequency.value)) {
    throw new Error(`Invalid frequency: ${frequency.value}`)
  }

  return {
    type: 'oscillator',
    gainCurve: transformCurve(voice.envelope, gainTransform),
    duration: voice.duration?.value,
    shape,
    frequency: frequency.value
  }
}

function createEffect (program: Program, effect: Effect, builder: Builder): SubGraph {
  switch (effect.type) {
    case 'gain': {
      return toSubGraph(builder.addNode<GainNode>('gain', {
        gain: computeParameterCurve(effect.gain, program, gainTransform)
      }))
    }

    case 'pan': {
      return toSubGraph(builder.addNode<PanNode>('pan', {
        pan: computeParameterCurve(effect.pan, program, panTransform)
      }))
    }

    case 'lowpass': {
      return toSubGraph(builder.addNode<BiquadNode>('biquad', {
        filterType: 'lowpass',
        frequency: computeParameterCurve(effect.frequency, program, frequencyTransform),
        // TODO configurable rolloff
        rolloffPerOctave: 12 as Numeric<'db'>
      }))
    }

    case 'highpass': {
      return toSubGraph(builder.addNode<BiquadNode>('biquad', {
        filterType: 'highpass',
        frequency: computeParameterCurve(effect.frequency, program, frequencyTransform),
        // TODO configurable rolloff
        rolloffPerOctave: 12 as Numeric<'db'>
      }))
    }

    case 'width': {
      if (Number.isNaN(effect.width.value)) {
        throw new Error(`Invalid width: ${effect.width.value}`)
      }

      return toSubGraph(builder.addNode<WidthNode>('width', {
        // TODO time variant
        width: Math.max(0, Math.min(1, effect.width.value)) as Numeric<undefined>
      }))
    }

    case 'delay': {
      if (Number.isNaN(effect.feedback.initial.value)) {
        throw new Error(`Invalid feedback: ${effect.feedback.initial.value}`)
      }

      if (!Number.isFinite(effect.time.value)) {
        throw new Error(`Invalid time: ${effect.time.value}`)
      }

      const delayNodeId = builder.addNode<DelayNode>('delay', {
        // TODO time variant
        time: timeToSeconds(effect.time, program.track.tempo.value)
      })

      if (effect.feedback.initial.value > 0 || program.automations.has(effect.feedback.id)) {
        const feedbackGainId = builder.addNode<GainNode>('gain', {
          gain: computeParameterCurve(effect.feedback, program, feedbackTransform)
        })

        builder.addEdge(delayNodeId, feedbackGainId)
        builder.addEdge(feedbackGainId, delayNodeId)
      }

      return createDryWetMix(delayNodeId, effect.mix.value, effect.wet.value, builder)
    }

    case 'reverb': {
      if (!Number.isFinite(effect.decay.value)) {
        throw new Error(`Invalid decay: ${effect.decay.value}`)
      }

      const mix = Math.max(0, Math.min(1, effect.mix.value))
      if (mix <= 0) {
        return toSubGraph(builder.addNode<IdentityNode>('identity', {}))
      }

      const reverbId = builder.addNode<ReverbNode>('reverb', {
        // TODO time variant
        decay: timeToSeconds(effect.decay, program.track.tempo.value)
      })

      return createDryWetMix(reverbId, mix, effect.wet.value, builder)
    }

    case 'clip': {
      // The wave shaper curve is not time-variant. Hence, we use two gain nodes to implement the threshold,
      // one in front of the wave shaper with gain of -threshold, and one after with gain of +threshold to compensate.
      // If the threshold is -Infinity, we must of course not apply a +Infinity gain, which would be illegal.

      const invert = (value: Numeric<undefined>): Numeric<undefined> => {
        if (value === 0) {
          throw new Error('Invalid gain')
        }

        return (1 / value) as Numeric<undefined>
      }

      const thresholdGain = computeParameterCurve(effect.threshold, program, gainTransform)

      const inputId = builder.addNode<GainNode>('gain', {
        gain: {
          initial: runtimeNumeric(undefined, invert(thresholdGain.initial.value)),
          points: thresholdGain.points.map(({ time, value, shape }) => ({ time, value: runtimeNumeric(undefined, invert(value.value)), shape }))
        }
      })

      const waveShaperId = builder.addNode<WaveShaperNode>('wave_shaper', {
        curve: new Float32Array([-1, 0, 1])
      })

      const outputId = builder.addNode<GainNode>('gain', {
        gain: thresholdGain
      })

      builder.addEdge(inputId, waveShaperId)
      builder.addEdge(waveShaperId, outputId)

      return {
        inputs: [inputId],
        outputs: [outputId]
      }
    }
  }
}

function createDryWetMix (effectId: NodeId, mix: number, wetGain: Numeric<'db'>, builder: Builder): SubGraph {
  if (Number.isNaN(mix)) {
    throw new Error(`Invalid mix: ${mix}`)
  }

  if (mix <= 0) {
    return toSubGraph(builder.addNode<IdentityNode>('identity', {}))
  }

  const wetLevelId = createOptionalGainNode(wetGain, builder)

  if (mix >= 1) {
    if (wetLevelId == null) {
      return toSubGraph(effectId)
    }

    builder.addEdge(effectId, wetLevelId)

    return {
      inputs: [effectId],
      outputs: [wetLevelId]
    }
  }

  // dry: 0.0...0.5 -> 100%,   0.75: 50%,         1.0:   0%
  // wet:       0.0 ->   0%,   0.25: 50%,   0.5...1.0: 100%

  const dry = Math.max(0, Math.min(1, (1 - mix) * 2))
  const dryNodeId = builder.addNode<GainNode>('gain', {
    gain: { initial: runtimeNumeric(undefined, dry), points: [] }
  })

  const wet = Math.max(0, Math.min(1, mix * 2))
  const wetNodeId = builder.addNode<GainNode>('gain', {
    gain: { initial: runtimeNumeric(undefined, wet), points: [] }
  })

  const wetInputId = wetLevelId ?? effectId
  if (wetLevelId != null) {
    builder.addEdge(effectId, wetLevelId)
  }

  builder.addEdge(wetInputId, wetNodeId)

  return {
    inputs: [dryNodeId, effectId],
    outputs: [dryNodeId, wetNodeId]
  }
}

function createOptionalGainNode (wetGain: Numeric<'db'>, builder: Builder): NodeId | undefined {
  if (wetGain === 0) {
    return undefined
  }

  const gain = runtimeNumeric(undefined, dbToGain(wetGain))

  return builder.addNode<GainNode>('gain', {
    // TODO time variant
    gain: { initial: gain, points: [] }
  })
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
  let offsetBeats = 0

  for (const part of track.parts) {
    for (const routing of part.routings) {
      const nodeId = instruments.get(routing.destination.id)
      if (nodeId == null) {
        continue
      }

      const events = renderPatternEvents(routing.source.value, part.length).map((event) => ({
        ...event,
        time: runtimeNumeric('beats', event.time.value + offsetBeats)
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
  const intervalSeconds = options.interval
  if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
    throw new Error(`Invalid metering interval: ${options.interval}`)
  }

  const createMeters = (key: EntityKey, sources: readonly NodeId[]): void => {
    const gainMeterId = builder.addNode<GainMeterNode>('gain_meter', {
      key,
      interval: options.interval
    })

    builder.addMeters(key, { gainMeterId })
    builder.addEdges(sources, [gainMeterId])
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
