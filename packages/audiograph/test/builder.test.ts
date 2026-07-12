import type { BusId, InstrumentId } from '@core'
import { numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { createAudioGraphBuilder } from '../src/builder.js'
import { createEntityKey } from '../src/entities.js'
import type { NodeId } from '../src/graph.js'

describe('builder.ts', () => {
  const tempo = numeric('bpm', 120)
  const length = numeric('beats', 16)
  const beats = (value: number) => numeric('beats', value)
  const scalar = (value: number) => numeric(undefined, value)

  it('should maintain tempo and length', () => {
    const builder = createAudioGraphBuilder({ tempo, length })

    const graph = builder.graph()

    assert.strictEqual(graph.tempo, tempo)
    assert.strictEqual(graph.length, length)
  })

  it('should throw for infinite tempo', () => {
    assert.throws(() => createAudioGraphBuilder({ tempo: numeric('bpm', Infinity), length }))
    assert.throws(() => createAudioGraphBuilder({ tempo: numeric('bpm', -Infinity), length }))
  })

  it('should throw for non-positive tempo', () => {
    assert.throws(() => createAudioGraphBuilder({ tempo: numeric('bpm', 0), length }))
    assert.throws(() => createAudioGraphBuilder({ tempo: numeric('bpm', -120), length }))
  })

  it('should throw for negative length', () => {
    assert.throws(() => createAudioGraphBuilder({ tempo, length: numeric('beats', -1) }))
  })

  it('should throw for NaN tempo and length', () => {
    assert.throws(() => createAudioGraphBuilder({ tempo: numeric('bpm', Number.NaN), length }))
    assert.throws(() => createAudioGraphBuilder({ tempo, length: numeric('beats', Number.NaN) }))
  })

  it('should assign unique IDs to nodes', () => {
    const builder = createAudioGraphBuilder({ tempo, length })

    const node1 = builder.addNode('sample', { url: 'foo.wav' })
    const node2 = builder.addNode('sample', { url: 'bar.wav' })
    const node3 = builder.addNode('gain', { gain: 0.5 })

    assert.notStrictEqual(node1, node2)
    assert.notStrictEqual(node1, node3)
    assert.notStrictEqual(node2, node3)
  })

  it('should build a graph correctly', () => {
    const builder = createAudioGraphBuilder({ tempo, length })

    const node1 = builder.addNode('sample', { url: 'foo.wav' })
    const node2 = builder.addNode('gain', { gain: 0.5 })
    const node3 = builder.addNode('pan', { pan: -0.5 })

    builder.addEdge(node1, node2)
    builder.addEdge(node2, node3)

    const graph = builder.graph()

    assert.strictEqual(graph.nodes.size, 3)
    assert.deepStrictEqual(graph.edges, [
      { from: node1, to: node2 },
      { from: node2, to: node3 }
    ])
    assert.deepStrictEqual(graph.outputIds, [])
  })

  it('should set outputs', () => {
    const builder = createAudioGraphBuilder({ tempo, length })

    const node1 = builder.addNode('sample', { url: 'foo.wav' })
    builder.addNode('gain', { gain: 0.5 })
    builder.setOutput(node1)

    const graph = builder.graph()
    assert.deepStrictEqual(graph.outputIds, [node1])
  })

  it('should add multiple edges correctly', () => {
    const builder = createAudioGraphBuilder({ tempo, length })

    const node1 = builder.addNode('sample', { url: 'foo.wav' })
    const node2 = builder.addNode('gain', { gain: 0.5 })
    const node3 = builder.addNode('pan', { pan: -0.5 })
    const node4 = builder.addNode('reverb', { roomSize: 0.8 })

    builder.addEdges([node1, node2], [node3, node4])

    const graph = builder.graph()

    assert.strictEqual(graph.nodes.size, 4)
    assert.deepStrictEqual(graph.edges, [
      { from: node1, to: node3 },
      { from: node1, to: node4 },
      { from: node2, to: node3 },
      { from: node2, to: node4 }
    ])
  })

  it('should add note events', () => {
    const builder = createAudioGraphBuilder({ tempo, length })

    const node1 = builder.addNode('sampler', { url: 'foo.wav' })
    builder.addNoteEvents(node1, [
      { time: beats(0), pitch: 'C4', velocity: scalar(0.8) },
      { time: beats(1), pitch: 'C#4', velocity: scalar(0.8) },
      { time: beats(2), pitch: 'D4', velocity: scalar(0.8) }
    ])

    const graph = builder.graph()

    assert.strictEqual(graph.noteEvents.size, 1)
    assert.deepStrictEqual(graph.noteEvents.get(node1), [
      { time: beats(0), pitch: 'C4', velocity: scalar(0.8) },
      { time: beats(1), pitch: 'C#4', velocity: scalar(0.8) },
      { time: beats(2), pitch: 'D4', velocity: scalar(0.8) }
    ])
  })

  it('should throw for note events with invalid time', () => {
    const builder = createAudioGraphBuilder({ tempo, length })

    const node1 = builder.addNode('sampler', { url: 'foo.wav' })
    assert.throws(() => builder.addNoteEvents(node1, [
      { time: beats(-1), pitch: 'C4', velocity: scalar(0.8) }
    ]))

    assert.throws(() => builder.addNoteEvents(node1, [
      { time: beats(Infinity), pitch: 'C4', velocity: scalar(0.8) }
    ]))

    assert.throws(() => builder.addNoteEvents(node1, [
      { time: beats(-Infinity), pitch: 'C4', velocity: scalar(0.8) }
    ]))

    assert.throws(() => builder.addNoteEvents(node1, [
      { time: beats(Number.NaN), pitch: 'C4', velocity: scalar(0.8) }
    ]))
  })

  it('should throw for note events with invalid velocity', () => {
    const builder = createAudioGraphBuilder({ tempo, length })

    const node1 = builder.addNode('sampler', { url: 'foo.wav' })
    assert.throws(() => builder.addNoteEvents(node1, [
      { time: beats(0), pitch: 'C4', velocity: scalar(-0.1) }
    ]))

    assert.throws(() => builder.addNoteEvents(node1, [
      { time: beats(0), pitch: 'C4', velocity: scalar(1.1) }
    ]))

    assert.throws(() => builder.addNoteEvents(node1, [
      { time: beats(0), pitch: 'C4', velocity: scalar(Number.NaN) }
    ]))
  })

  it('should throw for note events with invalid pitch', () => {
    const builder = createAudioGraphBuilder({ tempo, length })

    const node1 = builder.addNode('sampler', { url: 'foo.wav' })
    assert.throws(() => builder.addNoteEvents(node1, [
      { time: beats(0), pitch: 'H4' as never, velocity: scalar(0.8) }
    ]))

    assert.throws(() => builder.addNoteEvents(node1, [
      { time: beats(0), pitch: 'C#11' as never, velocity: scalar(0.8) }
    ]))
  })

  it('should throw for note events with invalid gate', () => {
    const builder = createAudioGraphBuilder({ tempo, length })

    const node1 = builder.addNode('sampler', { url: 'foo.wav' })
    assert.throws(() => builder.addNoteEvents(node1, [
      { time: beats(0), pitch: 'C4', velocity: scalar(0.8), gate: beats(-1) }
    ]))

    assert.throws(() => builder.addNoteEvents(node1, [
      { time: beats(0), pitch: 'C4', velocity: scalar(0.8), gate: beats(Infinity) }
    ]))

    assert.throws(() => builder.addNoteEvents(node1, [
      { time: beats(0), pitch: 'C4', velocity: scalar(0.8), gate: beats(-Infinity) }
    ]))

    assert.throws(() => builder.addNoteEvents(node1, [
      { time: beats(0), pitch: 'C4', velocity: scalar(0.8), gate: beats(Number.NaN) }
    ]))
  })

  it('should add meters', () => {
    const builder = createAudioGraphBuilder({ tempo, length })

    // output
    const outputKey = createEntityKey({ type: 'output' })
    const outputMeters = {
      gainMeterId: 100 as NodeId
    }
    builder.addMeters(outputKey, outputMeters)

    // bus
    const busKey = createEntityKey({ type: 'bus', id: 1 as BusId })
    const busMeters = {
      gainMeterId: 200 as NodeId
    }
    builder.addMeters(busKey, busMeters)

    // instrument
    const instrumentKey = createEntityKey({ type: 'instrument', id: 2 as InstrumentId })
    const instrumentMeters = {
      gainMeterId: 300 as NodeId
    }
    builder.addMeters(instrumentKey, instrumentMeters)

    const graph = builder.graph()

    assert.deepStrictEqual([...graph.meters.entries()], [
      [outputKey, outputMeters],
      [busKey, busMeters],
      [instrumentKey, instrumentMeters]
    ])
  })
})
