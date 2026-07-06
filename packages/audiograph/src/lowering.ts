import type { Bus, BusId, Effect, Envelope, Instrument, InstrumentId, MidiNote, MixerRouting, Oscillator, Program, Sample, Track, Voice } from '@core'
import { beatsToSeconds, calculateTotalLength, convertPitchToMidi, getMidiFrequency, renderPatternEvents, timeToSeconds } from '@core'
import type { Numeric } from '@utility'
import { numeric } from '@utility'
import { feedbackTransform, frequencyTransform, gainTransform, panTransform, timeVariant, toTimeVariant } from './automation.js'
import type { AudioGraphBuilder } from './builder.js'
import { createAudioGraphBuilder } from './builder.js'
import { dbToGain, DEFAULT_ROOT_NOTE } from './constants.js'
import type { EntityKey } from './entities.js'
import { createEntityKey } from './entities.js'
import { applyEnvelope } from './envelope.js'
import type { AnyNode, AudioGraph, NodeId, NoteOptions } from './graph.js'
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
    tempo: program.track.tempo,
    length: calculateTotalLength(program)
  })

  const output = builder.addNode<IdentityNode>('identity', {})
  builder.setOutput(output.id)

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

  const instrumentNode = builder.addNode<InstrumentNode>('instrument', {
    trigger: (note) => {
      return instrument.trigger().map((voice) => createSourceNode(voice, rootNote, note))
    }
  })

  const gain = builder.addNode<GainNode>('gain', {
    gain: toTimeVariant(instrument.gain, program, gainTransform)
  })

  builder.addEdge(instrumentNode.id, gain.id)

  return {
    inputs: [instrumentNode.id],
    outputs: [gain.id],
    instrument: instrumentNode.id
  }
}

function createSourceNode (voice: Voice, rootNote: MidiNote, note: Omit<NoteOptions, 'time'>): SourceNode {
  const envelope = (() => {
    const a = voice.envelope.attack.value
    const d = voice.envelope.decay.value
    const s = voice.envelope.sustain.value
    const r = voice.envelope.release.value

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

  switch (voice.source.type) {
    case 'sample':
      return createSampleSourceNode(voice.source, envelope, rootNote, note)

    case 'oscillator':
      return createOscillatorSourceNode(voice.source, envelope, rootNote, note)
  }
}

function createSampleSourceNode (sample: Sample, envelope: Envelope, rootNote: MidiNote, note: Omit<NoteOptions, 'time'>): SourceNode {
  const { assetId } = sample

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

  const holdDuration = (() => {
    if (note.duration == null || length == null) {
      return note.duration ?? length?.value
    }
    return Math.min(note.duration, length.value)
  })()

  const gainCurve = applyEnvelope(envelope, { ...note, duration: holdDuration })
  const duration = holdDuration != null
    ? gainCurve.points.at(-1)?.time
    : undefined

  const playbackRate = Math.pow(2, ((note.pitch ?? rootNote) - rootNote) / 12)

  return {
    id: -1 as NodeId, // TODO: avoid invalid id
    type: 'sample',
    gainCurve,
    duration,
    assetId,
    playbackRate
  }
}

function createOscillatorSourceNode (oscillator: Oscillator, envelope: Envelope, rootNote: MidiNote, note: Omit<NoteOptions, 'time'>): SourceNode {
  const { shape } = oscillator

  const gainCurve = applyEnvelope(envelope, note)
  const duration = note.duration != null
    ? gainCurve.points.at(-1)?.time
    : undefined

  const frequency = numeric('hz', getMidiFrequency(note.pitch ?? rootNote))

  return {
    id: -1 as NodeId, // TODO: avoid invalid id
    type: 'oscillator',
    gainCurve,
    duration,
    shape,
    frequency
  }
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
      if (Number.isNaN(effect.feedback.initial.value)) {
        throw new Error(`Invalid feedback: ${effect.feedback.initial.value}`)
      }

      if (!Number.isFinite(effect.time.value)) {
        throw new Error(`Invalid time: ${effect.time.value}`)
      }

      const delayNode = builder.addNode<DelayNode>('delay', {
        // TODO time variant
        time: timeToSeconds(effect.time, program.track.tempo)
      })

      if (effect.feedback.initial.value > 0 || program.automations.has(effect.feedback.id)) {
        const feedbackGain = builder.addNode<GainNode>('gain', {
          gain: toTimeVariant(effect.feedback, program, feedbackTransform)
        })

        builder.addEdge(delayNode.id, feedbackGain.id)
        builder.addEdge(feedbackGain.id, delayNode.id)
      }

      return createDryWetMix(delayNode, effect.mix.value, effect.wet, builder)
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

      return createDryWetMix(reverb, mix, effect.wet, builder)
    }

    case 'clip': {
      // The wave shaper curve is not time-variant. Hence, we use two gain nodes to implement the threshold,
      // one in front of the wave shaper with gain of -threshold, and one after with gain of +threshold to compensate.
      // If the threshold is -Infinity, we must of course not apply a +Infinity gain, which would be illegal.

      const invert = (value: Numeric<undefined>): Numeric<undefined> => {
        if (value.value === 0) {
          throw new Error('Invalid gain')
        }

        return numeric(undefined, 1 / value.value)
      }

      const thresholdGain = toTimeVariant(effect.threshold, program, gainTransform)

      const input = builder.addNode<GainNode>('gain', {
        gain: {
          initial: invert(thresholdGain.initial),
          points: thresholdGain.points.map(({ time, value, curve }) => ({ time, value: invert(value), curve }))
        }
      })

      const waveShaper = builder.addNode<WaveShaperNode>('wave_shaper', {
        curve: new Float32Array([-1, 0, 1])
      })

      const output = builder.addNode<GainNode>('gain', {
        gain: thresholdGain
      })

      builder.addEdge(input.id, waveShaper.id)
      builder.addEdge(waveShaper.id, output.id)

      return {
        inputs: [input.id],
        outputs: [output.id]
      }
    }
  }
}

function createDryWetMix (effect: Node, mix: number, wetGain: Numeric<'db'>, builder: Builder): SubGraph {
  if (Number.isNaN(mix)) {
    throw new Error(`Invalid mix: ${mix}`)
  }

  if (mix <= 0) {
    return toSubGraph(builder.addNode<IdentityNode>('identity', {}))
  }

  const wetLevel = createOptionalGainNode(wetGain, builder)

  if (mix >= 1) {
    if (wetLevel == null) {
      return toSubGraph(effect)
    }

    builder.addEdge(effect.id, wetLevel.id)

    return {
      inputs: [effect.id],
      outputs: [wetLevel.id]
    }
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

  const wetInput = wetLevel ?? effect
  if (wetLevel != null) {
    builder.addEdge(effect.id, wetLevel.id)
  }

  builder.addEdge(wetInput.id, wetNode.id)

  return {
    inputs: [dryNode.id, effect.id],
    outputs: [dryNode.id, wetNode.id]
  }
}

function createOptionalGainNode (wetGain: Numeric<'db'>, builder: Builder): Node | undefined {
  if (wetGain.value === 0) {
    return undefined
  }

  const gain = dbToGain(wetGain.value)

  return builder.addNode<GainNode>('gain', {
    // TODO time variant
    gain: timeVariant(numeric(undefined, gain), [])
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
        velocity: event.velocity.value,
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
