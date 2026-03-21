import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createAudioGraphBuilder } from '../src/builder.js'

describe('builder.ts', () => {
  it('should assign unique IDs to nodes', () => {
    const builder = createAudioGraphBuilder()

    const node1 = builder.addNode('sample', { url: 'foo.wav' })
    const node2 = builder.addNode('sample', { url: 'bar.wav' })
    const node3 = builder.addNode('gain', { gain: 0.5 })

    assert.notStrictEqual(node1.id, node2.id)
    assert.notStrictEqual(node1.id, node3.id)
    assert.notStrictEqual(node2.id, node3.id)
  })

  it('should build a graph correctly', () => {
    const builder = createAudioGraphBuilder()

    const node1 = builder.addNode('sample', { url: 'foo.wav' })
    const node2 = builder.addNode('gain', { gain: 0.5 })
    const node3 = builder.addNode('pan', { pan: -0.5 })

    builder.addEdge(node1.id, node2.id)
    builder.addEdge(node2.id, node3.id)

    builder.addOutput(node3.id)

    const graph = builder.graph()

    assert.strictEqual(graph.nodes.size, 3)
    assert.deepStrictEqual(graph.edges, [
      { from: node1.id, to: node2.id },
      { from: node2.id, to: node3.id }
    ])
    assert.deepStrictEqual(graph.outputIds, [node3.id])
  })

  it('should add multiple edges correctly', () => {
    const builder = createAudioGraphBuilder()

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
})
