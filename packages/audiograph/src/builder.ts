import type { AudioGraph, Edge, Node, NodeId } from './graph.js'

export interface AudioGraphBuilder {
  readonly addNode: <T extends Node> (type: T['type'], node: Omit<T, 'id' | 'type'>) => T

  readonly addEdge: (from: NodeId, to: NodeId) => void
  readonly addEdges: (from: readonly NodeId[], to: readonly NodeId[]) => void

  readonly addOutput: (nodeId: NodeId) => void

  readonly graph: () => AudioGraph
}

export function createAudioGraphBuilder (): AudioGraphBuilder {
  const nodes = new Map<NodeId, Node>()
  const edges: Edge[] = []
  const outputIds: NodeId[] = []

  let nextId = 1 as NodeId

  const addNode: AudioGraphBuilder['addNode'] = <T extends Node>(type: T['type'], node: Omit<T, 'id' | 'type'>): T => {
    const id = nextId++ as NodeId
    const newNode = { ...node, id, type } as T
    nodes.set(id, newNode)
    return newNode
  }

  const addEdge: AudioGraphBuilder['addEdge'] = (from, to) => {
    edges.push({ from, to })
  }

  const addEdges: AudioGraphBuilder['addEdges'] = (from, to) => {
    for (const fromId of from) {
      for (const toId of to) {
        edges.push({ from: fromId, to: toId })
      }
    }
  }

  const addOutput: AudioGraphBuilder['addOutput'] = (nodeId) => {
    outputIds.push(nodeId)
  }

  const graph: AudioGraphBuilder['graph'] = () => ({
    nodes,
    edges,
    outputIds
  })

  return {
    addNode,
    addEdge,
    addEdges,
    addOutput,
    graph
  }
}
