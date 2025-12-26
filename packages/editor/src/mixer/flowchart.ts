import type { Bus, BusId, Instrument, InstrumentId, Program } from '@core/program.js'
import type { FlowEdge, FlowEdgeId, FlowEdgeStyle, FlowNode, FlowNodeId } from '@flowchart/index.js'

const mixerObjectTypes = ['Bus', 'Instrument'] as const
type MixerObjectType = typeof mixerObjectTypes[number]
type MixerObjectId = BusId | InstrumentId
type MixerObject = Bus | Instrument

type MixerNodeData = {
  readonly type: 'Output'
  readonly object?: undefined
} | {
  readonly type: 'Bus'
  readonly object: Bus
} | {
  readonly type: 'Instrument'
  readonly object: Instrument
}

interface MixerEdgeData {
  readonly explicit: boolean
}

function getObjectsOfType (program: Program, type: MixerObjectType): Iterable<[MixerObjectId, MixerObject]> {
  switch (type) {
    case 'Bus':
      return program.mixer.buses.map((bus) => [bus.id, bus])
    case 'Instrument':
      return program.instruments.entries()
  }
}

export type MixerFlowNode = FlowNode<MixerNodeData>
export type MixerFlowEdge = FlowEdge<MixerEdgeData>

export interface MixerFlowchartOptions {
  readonly nodeSize: Pick<MixerFlowNode, 'width' | 'height'>
  readonly explicitEdgeStyle: FlowEdgeStyle
  readonly implicitEdgeStyle: FlowEdgeStyle
  readonly highlightEdgeStyle?: Partial<FlowEdgeStyle>
}

export interface MixerFlowchart {
  readonly nodes: readonly MixerFlowNode[]
  readonly edges: readonly MixerFlowEdge[]
}

export function createMixerFlowchart (program: Program, options: MixerFlowchartOptions): MixerFlowchart {
  const nodes = createNodes(program, options)
  const edges = createEdges(program, options, nodes)

  return { nodes: nodes.all, edges }
}

interface Nodes {
  readonly all: readonly MixerFlowNode[]
  readonly output: MixerFlowNode
  readonly byObject: Readonly<Record<MixerObjectType, ReadonlyMap<MixerObjectId, MixerFlowNode>>>
}

function createNodes (program: Program, options: MixerFlowchartOptions): Nodes {
  const all: MixerFlowNode[] = []

  const byObject = Object.fromEntries(
    mixerObjectTypes.map((type) => [type, new Map()])
  ) as Record<MixerObjectType, Map<MixerObjectId, MixerFlowNode>>

  const createNode = (data: MixerNodeData) => ({
    ...options.nodeSize,
    id: `${data.type}-${data.object?.id ?? 'main'}` as FlowNodeId,
    data
  })

  const output = createNode({ type: 'Output' })
  all.push(output)

  for (const type of mixerObjectTypes) {
    for (const [objectId, object] of getObjectsOfType(program, type)) {
      const node = createNode({ type, object } as any)
      all.push(node)
      byObject[type].set(objectId, node)
    }
  }

  return { all, output, byObject }
}

function createEdges (program: Program, options: MixerFlowchartOptions, nodes: Nodes): MixerFlowEdge[] {
  const { explicitEdgeStyle, implicitEdgeStyle } = options

  const edges: MixerFlowEdge[] = []

  const insertEdge = (edge: Pick<MixerFlowEdge, 'from' | 'to' | 'data'>): void => {
    const id = `${edges.length}-${edge.from}-${edge.to}` as FlowEdgeId
    const style = edge.data.explicit ? explicitEdgeStyle : implicitEdgeStyle
    const highlightStyle = options.highlightEdgeStyle
    edges.push({ ...edge, id, style, highlightStyle })
  }

  const routedObjects = Object.fromEntries(
    mixerObjectTypes.map((type) => [type, new Set()])
  ) as Record<MixerObjectType, Set<MixerObjectId>>

  for (const routing of program.mixer.routings) {
    const sourceType = routing.source.type
    const from = nodes.byObject[sourceType].get(routing.source.id)?.id

    const destinationType = routing.destination.type
    const to = nodes.byObject[destinationType].get(routing.destination.id)?.id

    routedObjects[sourceType].add(routing.source.id)

    if (from != null && to != null) {
      insertEdge({ from, to, data: { explicit: true } })
    }
  }

  // Unconnected nodes are connected to output
  for (const type of mixerObjectTypes) {
    for (const [objectId, node] of nodes.byObject[type]) {
      if (!routedObjects[type].has(objectId)) {
        insertEdge({ from: node.id, to: nodes.output.id, data: { explicit: false } })
      }
    }
  }

  return edges
}
