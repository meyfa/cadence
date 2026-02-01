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

interface MixerEdgeData {}

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

function createEdges (program: Program, options: MixerFlowchartOptions, nodes: Nodes): readonly MixerFlowEdge[] {
  const { explicitEdgeStyle, implicitEdgeStyle } = options

  const edges: MixerFlowEdge[] = []

  for (const routing of program.mixer.routings) {
    const sourceType = routing.source.type
    const from = nodes.byObject[sourceType].get(routing.source.id)?.id

    const destinationType = routing.destination.type
    const to = destinationType === 'Output'
      ? nodes.output.id
      : nodes.byObject[destinationType].get(routing.destination.id)?.id

    if (from != null && to != null) {
      const id = `${edges.length}-${from}-${to}` as FlowEdgeId
      const style = routing.implicit ? implicitEdgeStyle : explicitEdgeStyle
      const highlightStyle = options.highlightEdgeStyle
      edges.push({ id, from, to, data: {}, style, highlightStyle })
    }
  }

  return edges
}
