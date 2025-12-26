import { BusId, type Bus, type Instrument, type InstrumentId } from '@core/program.js'
import { Flowchart, type FlowEdge, type FlowEdgeId, type FlowNode, type FlowNodeId } from '@flowchart/index.js'
import clsx from 'clsx'
import { useCallback, useMemo, type FunctionComponent, type PropsWithChildren } from 'react'
import { usePrevious } from '../hooks/previous.js'
import { useCompilationState } from '../state/CompilationContext.js'

type MixerNodeData = {
  readonly type: 'output'
} | {
  readonly type: 'bus'
  readonly bus: Bus
} | {
  readonly type: 'instrument'
  readonly instrument: Instrument
}

interface MixerEdgeData {
  readonly unconnected?: boolean
}

const NODE_PROPERTIES = Object.freeze({
  width: 160,
  height: 48
})

const CONNECTED_EDGE_STYLE = Object.freeze({
  stroke: 'var(--color-frame-200)',
  strokeWidth: 2,
  strokeDasharray: undefined,
  markerEnd: 'arrow' as const
})

const UNCONNECTED_EDGE_STYLE = Object.freeze({
  ...CONNECTED_EDGE_STYLE,
  strokeDasharray: '2 4'
})

function getNodeLabel ({ data }: FlowNode<MixerNodeData>): string {
  switch (data.type) {
    case 'output':
      return 'main output'
    case 'bus':
      return data.bus.name
    case 'instrument': {
      return data.instrument.sampleUrl.split('/').pop() ?? data.instrument.sampleUrl
    }
  }
}

export const MixerPane: FunctionComponent = () => {
  const { program: currentProgram } = useCompilationState()
  const program = usePrevious(currentProgram)

  const tree = useMemo(() => {
    if (program == null) {
      return undefined
    }

    const nodes: Array<FlowNode<MixerNodeData>> = []
    const edges: Array<FlowEdge<MixerEdgeData>> = []

    const addNode = (id: FlowNodeId, data: MixerNodeData) => {
      nodes.push({
        id,
        data,
        ...NODE_PROPERTIES
      })
    }

    const addEdge = (from: FlowNodeId, to: FlowNodeId, data: MixerEdgeData = {}) => {
      edges.push({
        id: `${edges.length}-${from}-${to}` as FlowEdgeId,
        from,
        to,
        data,
        style: data.unconnected ? UNCONNECTED_EDGE_STYLE : CONNECTED_EDGE_STYLE
      })
    }

    const outputId = 'output' as FlowNodeId
    addNode(outputId, { type: 'output' })

    const busNodes = new Map<BusId, FlowNodeId>()
    const instrumentNodes = new Map<InstrumentId, FlowNodeId>()

    for (const bus of program.mixer.buses) {
      const id = `bus-${bus.id}` as FlowNodeId
      busNodes.set(bus.id, id)
      addNode(id, { type: 'bus', bus })
    }

    for (const [instrumentId, instrument] of program.instruments) {
      const id = `instrument-${instrumentId}` as FlowNodeId
      instrumentNodes.set(instrumentId, id)
      addNode(id, { type: 'instrument', instrument })
    }

    const routedBusIds = new Set<BusId>()
    const routedInstrumentIds = new Set<InstrumentId>()

    for (const routing of program.mixer.routings) {
      let sourceId: FlowNodeId | undefined
      if (routing.source.type === 'Bus') {
        sourceId = busNodes.get(routing.source.id)
        routedBusIds.add(routing.source.id)
      } else {
        sourceId = instrumentNodes.get(routing.source.id)
        routedInstrumentIds.add(routing.source.id)
      }

      const destinationId = busNodes.get(routing.destination.id)

      if (sourceId != null && destinationId != null) {
        addEdge(sourceId, destinationId)
      }
    }

    // Unconnected nodes are connected to output
    for (const [busId, nodeId] of busNodes) {
      if (!routedBusIds.has(busId)) {
        addEdge(nodeId, outputId, { unconnected: true })
      }
    }

    for (const [instrumentId, nodeId] of instrumentNodes) {
      if (!routedInstrumentIds.has(instrumentId)) {
        addEdge(nodeId, outputId, { unconnected: true })
      }
    }

    return { nodes, edges }
  }, [program])

  const renderNode = useCallback((node: FlowNode<MixerNodeData>) => {
    return (
      <div
        className={clsx(
          'w-full h-full',
          'bg-surface-200 border border-frame-200 rounded-md',
          'px-2 py-1 flex flex-col justify-center leading-snug text-sm'
        )}
      >
        <div className='text-content-100'>
          {node.data.type}
        </div>
        <div className='text-content-300 whitespace-nowrap text-ellipsis overflow-hidden'>
          {getNodeLabel(node)}
        </div>
      </div>
    )
  }, [])

  return (
    <div className='h-full text-content-300 relative flex flex-col overflow-none'>
      {tree == null && (
        <div className='p-4 text-content-100'>
          Graph not available. Check your program for errors.
        </div>
      )}

      {tree != null && (
        <>
          <div className='p-2 z-10 bg-surface-200 rounded-md flex gap-4 flex-wrap select-none shrink-0'>
            <LegendItem text='Source/destination'>
              <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 16'>
                <rect x='1' y='1' width='22' height='14' rx='4' ry='4' stroke='var(--color-frame-200)' strokeWidth='1' fill='var(--color-surface-200)' />
              </svg>
            </LegendItem>
            <LegendItem text='Routing (explicit)'>
              <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 16'>
                <line x1='1' y1='7' x2='23' y2='7' stroke={CONNECTED_EDGE_STYLE.stroke} strokeWidth={CONNECTED_EDGE_STYLE.strokeWidth} strokeDasharray={CONNECTED_EDGE_STYLE.strokeDasharray} />
              </svg>
            </LegendItem>
            <LegendItem text='Routing (default)'>
              <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 16'>
                <line x1='1' y1='7' x2='23' y2='7' stroke={UNCONNECTED_EDGE_STYLE.stroke} strokeWidth={UNCONNECTED_EDGE_STYLE.strokeWidth} strokeDasharray={UNCONNECTED_EDGE_STYLE.strokeDasharray} />
              </svg>
            </LegendItem>
          </div>

          <div className='flex-1 overflow-auto'>
            <div className='w-fit p-4 select-none'>
              <Flowchart<MixerNodeData>
                nodes={tree.nodes}
                edges={tree.edges}
                renderNode={renderNode}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const LegendItem: FunctionComponent<PropsWithChildren<{
  text: string
}>> = ({ text, children }) => {
  return (
    <div className='flex items-center gap-2 text-sm'>
      <div className='w-6 h-4 flex items-center justify-center'>
        {children}
      </div>
      {text}
    </div>
  )
}
