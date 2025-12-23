import { BusId, type Bus, type Instrument, type InstrumentId } from '@core/program.js'
import { CenterFocusWeakOutlined } from '@mui/icons-material'
import { useCallback, useMemo, useRef, type FunctionComponent, type PropsWithChildren } from 'react'
import { Canvas, Edge, MarkerArrow, Node, type CanvasRef, type EdgeData, type NodeData } from 'reaflow'
import { Button } from '../components/Button.js'
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

const NODE_PROPERTIES = {
  width: 160,
  height: 48
}

function makeNode (id: string, data: MixerNodeData): NodeData<MixerNodeData> {
  return {
    id,
    data,
    ...NODE_PROPERTIES
  }
}

function getNodeType ({ data }: NodeData<MixerNodeData>): string {
  return data?.type ?? 'unknown'
}

function getNodeLabel ({ data }: NodeData<MixerNodeData>): string {
  switch (data?.type) {
    case 'output':
      return 'main output'
    case 'bus':
      return data.bus.name
    case 'instrument': {
      return data.instrument.sampleUrl.split('/').pop() ?? data.instrument.sampleUrl
    }
  }

  return 'unknown'
}

export const MixerPane: FunctionComponent = () => {
  const { program: currentProgram } = useCompilationState()
  const program = usePrevious(currentProgram)

  const tree = useMemo(() => {
    if (program == null) {
      return undefined
    }

    const nodes: Array<NodeData<MixerNodeData>> = []
    const edges: Array<EdgeData<MixerEdgeData>> = []

    const outputId = 'output'
    nodes.push(makeNode(outputId, { type: 'output' }))

    const busNodes = new Map<BusId, string>()
    const instrumentNodes = new Map<InstrumentId, string>()

    for (const bus of program.mixer.buses) {
      const id = `bus-${bus.id}`
      busNodes.set(bus.id, id)
      nodes.push(makeNode(id, { type: 'bus', bus }))
    }

    for (const [instrumentId, instrument] of program.instruments) {
      const id = `instrument-${instrumentId}`
      instrumentNodes.set(instrumentId, id)
      nodes.push(makeNode(id, { type: 'instrument', instrument }))
    }

    const routedBusIds = new Set<BusId>()
    const routedInstrumentIds = new Set<InstrumentId>()

    for (const routing of program.mixer.routings) {
      let sourceId: string | undefined
      if (routing.source.type === 'Bus') {
        sourceId = busNodes.get(routing.source.id)
        routedBusIds.add(routing.source.id)
      } else {
        sourceId = instrumentNodes.get(routing.source.id)
        routedInstrumentIds.add(routing.source.id)
      }

      const destinationId = busNodes.get(routing.destination.id)

      if (sourceId != null && destinationId != null) {
        edges.push({
          id: `${sourceId}-${destinationId}`,
          from: sourceId,
          to: destinationId
        })
      }
    }

    // Unconnected nodes are connected to output
    for (const [busId, nodeId] of busNodes) {
      if (!routedBusIds.has(busId)) {
        edges.push({
          id: `${nodeId}-${outputId}`,
          from: nodeId,
          to: outputId,
          data: {
            unconnected: true
          }
        })
      }
    }

    for (const [instrumentId, nodeId] of instrumentNodes) {
      if (!routedInstrumentIds.has(instrumentId)) {
        edges.push({
          id: `${nodeId}-${outputId}`,
          from: nodeId,
          to: outputId,
          data: {
            unconnected: true
          }
        })
      }
    }

    return { nodes, edges }
  }, [program])

  const canvasRef = useRef<CanvasRef>(null)

  const graphNode = useMemo(() => {
    return (
      <Node rx={6} ry={6} style={{ fill: 'var(--color-surface-200)', stroke: 'var(--color-frame-200)', strokeWidth: 1 }}>
        {(node) => (
          <foreignObject width={node.width} height={node.height} x={0} y={0}>
            <div className='w-full h-full px-4 py-1 flex flex-col justify-center leading-snug text-sm'>
              <div className='text-content-100'>
                {getNodeType(node.node)}
              </div>
              <div className='text-content-300 whitespace-nowrap text-ellipsis overflow-hidden'>
                {getNodeLabel(node.node)}
              </div>
            </div>
          </foreignObject>
        )}
      </Node>
    )
  }, [])

  const renderEdge = useCallback((edge: EdgeData<MixerEdgeData>) => {
    return (
      <Edge
        style={{
          stroke: 'var(--color-frame-200)',
          strokeWidth: 2,
          strokeDasharray: (edge).data?.unconnected === true ? '2 4' : undefined
        }}
      />
    )
  }, [])

  const arrow = useMemo(() => {
    return (
      <MarkerArrow size={4} style={{ fill: 'var(--color-frame-200)' }} />
    )
  }, [])

  return (
    <div className='h-full overflow-none text-content-300 relative'>
      {tree == null && (
        <div className='p-4 text-content-100'>
          Graph not available. Check your program for errors.
        </div>
      )}

      {tree != null && (
        <>
          <div className='absolute top-2 left-2 p-2 z-10 bg-surface-200 rounded-md flex flex-col gap-1 select-none'>
            <LegendItem text='Source/destination'>
              <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 16'>
                <rect x='1' y='1' width='22' height='14' rx='4' ry='4' stroke='var(--color-frame-200)' strokeWidth='1' fill='var(--color-surface-200)' />
              </svg>
            </LegendItem>
            <LegendItem text='Routing (explicit)'>
              <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 16'>
                <line x1='1' y1='7' x2='23' y2='7' stroke='var(--color-frame-200)' strokeWidth='2' />
              </svg>
            </LegendItem>
            <LegendItem text='Routing (default)'>
              <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 16'>
                <line x1='1' y1='7' x2='23' y2='7' stroke='var(--color-frame-200)' strokeWidth='2' strokeDasharray='2 4' />
              </svg>
            </LegendItem>
          </div>

          <div className='absolute top-4 right-4 z-10'>
            <Button onClick={() => canvasRef.current?.fitCanvas?.()}>
              <CenterFocusWeakOutlined className='mr-2' />
              Center
            </Button>
          </div>

          <Canvas
            animated={false}
            ref={canvasRef}
            readonly
            nodes={tree.nodes}
            edges={tree.edges}
            direction='LEFT'
            fit={true}
            pannable={true}
            panType='drag'
            zoomable={false}
            minZoom={0}
            maxZoom={0}
            node={graphNode}
            edge={renderEdge}
            arrow={arrow}
            className='select-none'
          />
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
