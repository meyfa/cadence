import type { BusId, InstrumentId, MidiNote } from '@core'
import { numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { createAudioGraphBuilder } from '../src/builder.js'
import { createEntityKey } from '../src/entities.js'
import type { NodeId } from '../src/graph.js'

describe('builder.ts', () => {
  const tempo = numeric('bpm', 120)
  const length = numeric('beats', 16)

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

    assert.notStrictEqual(node1.id, node2.id)
    assert.notStrictEqual(node1.id, node3.id)
    assert.notStrictEqual(node2.id, node3.id)
  })

  it('should build a graph correctly', () => {
    const builder = createAudioGraphBuilder({ tempo, length })

    const node1 = builder.addNode('sample', { url: 'foo.wav' })
    const node2 = builder.addNode('gain', { gain: 0.5 })
    const node3 = builder.addNode('pan', { pan: -0.5 })

    builder.addEdge(node1.id, node2.id)
    builder.addEdge(node2.id, node3.id)

    const graph = builder.graph()

    assert.strictEqual(graph.nodes.size, 3)
    assert.deepStrictEqual(graph.edges, [
      { from: node1.id, to: node2.id },
      { from: node2.id, to: node3.id }
    ])
    assert.deepStrictEqual(graph.outputIds, [])
  })

  it('should set outputs', () => {
    const builder = createAudioGraphBuilder({ tempo, length })

    const node1 = builder.addNode('sample', { url: 'foo.wav' })
    builder.addNode('gain', { gain: 0.5 })
    builder.setOutput(node1.id)

    const graph = builder.graph()
    assert.deepStrictEqual(graph.outputIds, [node1.id])
  })

  it('should add multiple edges correctly', () => {
    const builder = createAudioGraphBuilder({ tempo, length })

    const node1 = builder.addNode('sample', { url: 'foo.wav' })
    const node2 = builder.addNode('gain', { gain: 0.5 })
    const node3 = builder.addNode('pan', { pan: -0.5 })
    const node4 = builder.addNode('reverb', { roomSize: 0.8 })

    builder.addEdges([node1.id, node2.id], [node3.id, node4.id])

    const graph = builder.graph()

    assert.strictEqual(graph.nodes.size, 4)
    assert.deepStrictEqual(graph.edges, [
      { from: node1.id, to: node3.id },
      { from: node1.id, to: node4.id },
      { from: node2.id, to: node3.id },
      { from: node2.id, to: node4.id }
    ])
  })

  it('should add note events', () => {
    const builder = createAudioGraphBuilder({ tempo, length })

    const node1 = builder.addNode('sampler', { url: 'foo.wav' })
    builder.addNoteEvents(node1.id, [
      { time: 0, pitch: 60 as MidiNote, velocity: 0.8 },
      { time: 1, pitch: 61 as MidiNote, velocity: 0.8 },
      { time: 2, pitch: 62 as MidiNote, velocity: 0.8 }
    ])

    const graph = builder.graph()

    assert.strictEqual(graph.noteEvents.size, 1)
    assert.deepStrictEqual(graph.noteEvents.get(node1.id), [
      { time: 0, pitch: 60, velocity: 0.8 },
      { time: 1, pitch: 61, velocity: 0.8 },
      { time: 2, pitch: 62, velocity: 0.8 }
    ])
  })

  it('should throw for note events with invalid time', () => {
    const builder = createAudioGraphBuilder({ tempo, length })

    const node1 = builder.addNode('sampler', { url: 'foo.wav' })
    assert.throws(() => builder.addNoteEvents(node1.id, [
      { time: -1, pitch: 60 as MidiNote, velocity: 0.8 }
    ]))

    assert.throws(() => builder.addNoteEvents(node1.id, [
      { time: Infinity, pitch: 60 as MidiNote, velocity: 0.8 }
    ]))

    assert.throws(() => builder.addNoteEvents(node1.id, [
      { time: -Infinity, pitch: 60 as MidiNote, velocity: 0.8 }
    ]))

    assert.throws(() => builder.addNoteEvents(node1.id, [
      { time: Number.NaN, pitch: 60 as MidiNote, velocity: 0.8 }
    ]))
  })

  it('should throw for note events with invalid velocity', () => {
    const builder = createAudioGraphBuilder({ tempo, length })

    const node1 = builder.addNode('sampler', { url: 'foo.wav' })
    assert.throws(() => builder.addNoteEvents(node1.id, [
      { time: 0, pitch: 60 as MidiNote, velocity: -0.1 }
    ]))

    assert.throws(() => builder.addNoteEvents(node1.id, [
      { time: 0, pitch: 60 as MidiNote, velocity: 1.1 }
    ]))

    assert.throws(() => builder.addNoteEvents(node1.id, [
      { time: 0, pitch: 60 as MidiNote, velocity: Number.NaN }
    ]))
  })

  it('should throw for note events with invalid pitch', () => {
    const builder = createAudioGraphBuilder({ tempo, length })

    const node1 = builder.addNode('sampler', { url: 'foo.wav' })
    assert.throws(() => builder.addNoteEvents(node1.id, [
      { time: 0, pitch: -1 as MidiNote, velocity: 0.8 }
    ]))

    assert.throws(() => builder.addNoteEvents(node1.id, [
      { time: 0, pitch: 128 as MidiNote, velocity: 0.8 }
    ]))
  })

  it('should throw for note events with invalid duration', () => {
    const builder = createAudioGraphBuilder({ tempo, length })

    const node1 = builder.addNode('sampler', { url: 'foo.wav' })
    assert.throws(() => builder.addNoteEvents(node1.id, [
      { time: 0, pitch: 60 as MidiNote, velocity: 0.8, duration: -1 }
    ]))

    assert.throws(() => builder.addNoteEvents(node1.id, [
      { time: 0, pitch: 60 as MidiNote, velocity: 0.8, duration: Infinity }
    ]))

    assert.throws(() => builder.addNoteEvents(node1.id, [
      { time: 0, pitch: 60 as MidiNote, velocity: 0.8, duration: -Infinity }
    ]))

    assert.throws(() => builder.addNoteEvents(node1.id, [
      { time: 0, pitch: 60 as MidiNote, velocity: 0.8, duration: Number.NaN }
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
