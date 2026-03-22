import { describe, it } from 'node:test'
import assert from 'node:assert'
import { computeLayout } from '../src/layout.js'
import type { FlowEdge, FlowEdgeId, FlowNode, FlowNodeId } from '../src/types.js'

describe('layout.ts', () => {
  it('should compute layout for an empty graph', () => {
    const layout = computeLayout([], [], {
      nodeSpacingX: 60,
      nodeSpacingY: 40
    })

    assert.strictEqual(layout.nodes.length, 0)
    assert.strictEqual(layout.edges.length, 0)
    assert.strictEqual(layout.totalWidth, 0)
    assert.strictEqual(layout.totalHeight, 0)
  })

  it('should compute layout for a single node', () => {
    const nodes = [
      { id: 'A' as FlowNodeId, data: 'Node A', width: 100, height: 50 }
    ] satisfies Array<FlowNode<string>>

    const layout = computeLayout(nodes, [], {
      nodeSpacingX: 60,
      nodeSpacingY: 40
    })

    assert.strictEqual(layout.nodes.length, 1)
    assert.strictEqual(layout.edges.length, 0)

    const nodeA = layout.nodes[0]
    assert.strictEqual(nodeA.node.id, 'A')
    assert.strictEqual(nodeA.x, 0)
    assert.strictEqual(nodeA.y, 0)

    assert.strictEqual(layout.totalWidth, 100)
    assert.strictEqual(layout.totalHeight, 50)
  })

  it('should compute layout for a simple graph', () => {
    const nodes = [
      { id: 'A' as FlowNodeId, data: 'Node A', width: 100, height: 50 },
      { id: 'B' as FlowNodeId, data: 'Node B', width: 100, height: 50 },
      { id: 'C' as FlowNodeId, data: 'Node C', width: 100, height: 50 }
    ] satisfies Array<FlowNode<string>>

    const edges = [
      { id: 'e1' as FlowEdgeId, from: 'A' as FlowNodeId, to: 'B' as FlowNodeId, data: 'Edge A-B' },
      { id: 'e2' as FlowEdgeId, from: 'B' as FlowNodeId, to: 'C' as FlowNodeId, data: 'Edge B-C' },
      { id: 'e3' as FlowEdgeId, from: 'A' as FlowNodeId, to: 'C' as FlowNodeId, data: 'Edge A-C' }
    ] satisfies Array<FlowEdge<string>>

    const layout = computeLayout(nodes, edges, {
      nodeSpacingX: 60,
      nodeSpacingY: 40
    })

    assert.strictEqual(layout.nodes.length, 3)
    assert.strictEqual(layout.edges.length, 3)

    const nodeA = layout.nodes.find((n) => n.node.id === 'A')
    const nodeB = layout.nodes.find((n) => n.node.id === 'B')
    const nodeC = layout.nodes.find((n) => n.node.id === 'C')

    assert.ok(nodeA != null && nodeB != null && nodeC != null)

    assert.strictEqual(nodeA.x, 320) // 2 * 100 (width) + 2 * 60 (spacing)
    assert.strictEqual(nodeA.y, 0)

    assert.strictEqual(nodeB.x, 160) // 1 * 100 (width) + 1 * 60 (spacing)
    assert.strictEqual(nodeB.y, 0)

    assert.strictEqual(nodeC.x, 0) // top left
    assert.strictEqual(nodeC.y, 0)

    const edgeE1 = layout.edges.find((e) => e.edge.id === 'e1')
    const edgeE2 = layout.edges.find((e) => e.edge.id === 'e2')
    const edgeE3 = layout.edges.find((e) => e.edge.id === 'e3')

    assert.ok(edgeE1 != null && edgeE2 != null && edgeE3 != null)

    // [ C ] <--+-- [ B ] <--+-- [ A ]
    //           \----------/

    assert.strictEqual(edgeE1.path, 'M 320 25 C 275 25, 305 25, 260 25') // A to B
    assert.strictEqual(edgeE2.path, 'M 160 25 C 115 25, 145 25, 100 25') // B to C
    assert.strictEqual(edgeE3.path, 'M 320 25 C 275 25, 320 70, 260 70 L 160 70 C 100 70, 145 25, 100 25') // A to C

    assert.strictEqual(layout.totalWidth, 420) // 3 * 100 (width) + 2 * 60 (spacing)
    assert.strictEqual(layout.totalHeight, 50) // max node height
  })
})
