import type { FlowEdge, FlowNode, FlowNodeId } from '../types.js'

export interface LayoutOptions {
  readonly nodeSpacingX: number
  readonly nodeSpacingY: number
}

export interface Layout<TNodeData = unknown, TEdgeData = unknown> {
  readonly nodes: ReadonlyArray<LayoutNode<TNodeData>>
  readonly edges: ReadonlyArray<LayoutEdge<TEdgeData>>
  readonly connections: Connections<TEdgeData>
  readonly totalWidth: number
  readonly totalHeight: number
}

export interface LayoutNode<TData = unknown> {
  readonly node: FlowNode<TData>
  readonly x: number
  readonly y: number
}

export interface LayoutEdge<TData = unknown> {
  readonly edge: FlowEdge<TData>
  readonly path: string
}

export interface Connections<TData> {
  readonly incoming: ReadonlyMap<FlowNodeId, ReadonlyArray<FlowEdge<TData>>>
  readonly outgoing: ReadonlyMap<FlowNodeId, ReadonlyArray<FlowEdge<TData>>>
}

export function computeLayout<TNodeData = unknown, TEdgeData = unknown> (
  nodes: ReadonlyArray<FlowNode<TNodeData>>,
  edges: ReadonlyArray<FlowEdge<TEdgeData>>,
  options: LayoutOptions
): Layout<TNodeData, TEdgeData> {
  const connections = computeNodeConnections(nodes, edges)

  // Root nodes have distance 0, their incoming connections distance 1, and so on.
  const distances = computeNodeDistances(connections)

  // Place nodes in columns based on the max distance from the root.
  const columns = computeColumns(nodes, distances)

  return layoutNodesAndEdges(columns, connections, options)
}

function computeNodeConnections<TNodeData, TEdgeData> (
  nodes: ReadonlyArray<FlowNode<TNodeData>>,
  edges: ReadonlyArray<FlowEdge<TEdgeData>>
): Connections<TEdgeData> {
  const incoming = new Map<FlowNodeId, Array<FlowEdge<TEdgeData>>>()
  const outgoing = new Map<FlowNodeId, Array<FlowEdge<TEdgeData>>>()

  for (const node of nodes) {
    incoming.set(node.id, [])
    outgoing.set(node.id, [])
  }

  for (const edge of edges) {
    incoming.get(edge.to)?.push(edge)
    outgoing.get(edge.from)?.push(edge)
  }

  return { incoming, outgoing }
}

function computeNodeDistances<TEdgeData> (
  { outgoing }: Connections<TEdgeData>
): ReadonlyMap<FlowNodeId, number> {
  const distances = new Map<FlowNodeId, number>()
  const visiting = new Set<FlowNodeId>()

  const computeDistance = (nodeId: FlowNodeId): number => {
    if (visiting.has(nodeId)) {
      throw new Error('Graph contains a cycle')
    }

    try {
      visiting.add(nodeId)

      const distance = distances.get(nodeId)
      if (distance != null) {
        return distance
      }

      const destinations = outgoing.get(nodeId)
      if (destinations == null || destinations.length === 0) {
        distances.set(nodeId, 0)
        return 0
      }

      const maxPrevDistance = Math.max(...destinations.map((edge) => computeDistance(edge.to)))

      const computedDistance = maxPrevDistance + 1
      distances.set(nodeId, computedDistance)

      return computedDistance
    } finally {
      visiting.delete(nodeId)
    }
  }

  for (const id of outgoing.keys()) {
    computeDistance(id)
  }

  return distances
}

type Column<TNodeData> = ReadonlyArray<FlowNode<TNodeData>>

function computeColumns<TNodeData> (
  nodes: ReadonlyArray<FlowNode<TNodeData>>,
  distances: ReadonlyMap<FlowNodeId, number>
): Array<Column<TNodeData>> {
  const columns: Array<Array<FlowNode<TNodeData>>> = []

  for (const node of nodes) {
    const distance = distances.get(node.id) ?? 0

    while (columns.length <= distance) {
      columns.push([])
    }

    columns[distance].push(node)
  }

  return columns
}

function layoutNodesAndEdges<TNodeData, TEdgeData> (
  columns: ReadonlyArray<ReadonlyArray<FlowNode<TNodeData>>>,
  connections: Connections<TEdgeData>,
  options: LayoutOptions
): Layout<TNodeData, TEdgeData> {
  const layout = {
    nodes: [] as Array<LayoutNode<TNodeData>>,
    edges: [] as Array<LayoutEdge<TEdgeData>>,
    connections,
    totalWidth: 0,
    totalHeight: 0
  }

  const nodeMap = new Map<FlowNodeId, LayoutNode<TNodeData>>()
  const columnMap = new Map<FlowNodeId, number>()

  let x = 0

  for (let columnIndex = 0; columnIndex < columns.length; ++columnIndex) {
    const column = columns[columnIndex]

    let y = 0
    let maxWidth = 0

    for (const node of column) {
      columnMap.set(node.id, columnIndex)

      const layoutNode = { node, x, y }
      layout.nodes.push(layoutNode)
      nodeMap.set(node.id, layoutNode)

      y += node.height
      layout.totalHeight = Math.max(layout.totalHeight, y)

      y += options.nodeSpacingY

      maxWidth = Math.max(maxWidth, node.width)
    }

    x += maxWidth
    layout.totalWidth = x

    x += options.nodeSpacingX
  }

  for (const [fromNodeId, outgoingEdges] of connections.outgoing.entries()) {
    const fromNode = nodeMap.get(fromNodeId)
    if (fromNode == null) {
      continue
    }

    for (const outgoingEdge of outgoingEdges) {
      const toNode = nodeMap.get(outgoingEdge.to)
      if (toNode == null) {
        continue
      }

      const fromColumnIndex = columnMap.get(fromNode.node.id) ?? 0
      const toColumnIndex = columnMap.get(toNode.node.id) ?? 0

      if (Math.abs(toColumnIndex - fromColumnIndex) <= 1) {
        layout.edges.push(createSimpleEdge(fromNode, toNode, outgoingEdge, options))
        continue
      }

      layout.edges.push(createColumnSpanningEdge(fromNode, toNode, outgoingEdge, options))
    }
  }

  return layout
}

function createSimpleEdge<TNodeData, TEdgeData> (
  fromNode: LayoutNode<TNodeData>,
  toNode: LayoutNode<TNodeData>,
  edge: FlowEdge<TEdgeData>,
  options: LayoutOptions
): LayoutEdge<TEdgeData> {
  const x1 = fromNode.x
  const y1 = fromNode.y + 0.5 * fromNode.node.height
  const x2 = toNode.x + toNode.node.width
  const y2 = toNode.y + 0.5 * toNode.node.height

  const dx = x2 - x1
  const dy = y2 - y1

  const cp1x = x1 + Math.sign(dx) * options.nodeSpacingX * 0.75
  const cp1y = y1 + Math.sign(dy) * options.nodeSpacingY * 0.25
  const cp2x = x2 - Math.sign(dx) * options.nodeSpacingX * 0.75
  const cp2y = y2 - Math.sign(dy) * options.nodeSpacingY * 0.25

  const path = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`

  return { edge, path }
}

function createColumnSpanningEdge<TNodeData, TEdgeData> (
  fromNode: LayoutNode<TNodeData>,
  toNode: LayoutNode<TNodeData>,
  edge: FlowEdge<TEdgeData>,
  options: LayoutOptions
): LayoutEdge<TEdgeData> {
  // To avoid edges crossing over nodes in intermediate columns, create a path that
  // goes down between the fromNode and the one below, then across, then into the toNode.

  const xFrom = fromNode.x
  const yFrom = fromNode.y + 0.5 * fromNode.node.height

  const xTo = toNode.x + toNode.node.width
  const yTo = toNode.y + 0.5 * toNode.node.height

  const direction = Math.sign(xTo - xFrom)

  const xAcrossStart = xFrom + direction * options.nodeSpacingX
  const xAcrossEnd = xTo - direction * options.nodeSpacingX
  const yAcross = fromNode.y + fromNode.node.height + 0.5 * options.nodeSpacingY

  const path = [
    `M ${xFrom} ${yFrom}`,
    // cubic bezier to the across start
    `C ${0.25 * xFrom + 0.75 * xAcrossStart} ${yFrom}, ${xFrom} ${yAcross}, ${xAcrossStart} ${yAcross}`,
    // line across
    `L ${xAcrossEnd} ${yAcross}`,
    // cubic bezier to the toNode
    `C ${xTo} ${yAcross}, ${0.25 * xTo + 0.75 * xAcrossEnd} ${yTo}, ${xTo} ${yTo}`
  ].join(' ')

  return { edge, path }
}
