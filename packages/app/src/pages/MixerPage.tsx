import { BusId, type Bus, type Instrument, type InstrumentId, type Program } from '@core/program.js'
import clsx from 'clsx'
import { useMemo, useRef, type FunctionComponent } from 'react'
import { Canvas, Edge, MarkerArrow, Node, type CanvasRef, type EdgeData, type NodeData } from 'reaflow'
import { Footer } from '../components/Footer.js'
import { pluralize } from '../utilities/strings.js'
import { Button } from '../components/Button.js'
import { CenterFocusWeakOutlined } from '@mui/icons-material'

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

export const MixerPage: FunctionComponent<{
  program: Program | undefined
}> = ({ program }) => {
  const instrumentCount = program?.instruments.size
  const busCount = program?.mixer.buses.length
  const routingCount = program?.mixer.routings.length

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

  return (
    <div className='h-full flex flex-col'>
      <div className='flex-1 min-h-0 overflow-none text-white relative'>
        {tree == null && (
          <div className='p-4'>
            <div className='text-xl mb-4'>
              Graph not available
            </div>

            Check your program for errors.
          </div>
        )}

        {tree != null && (
          <div className='absolute top-4 right-4 z-10'>
            <Button onClick={() => canvasRef.current?.fitCanvas?.()}>
              <CenterFocusWeakOutlined className='mr-2' />
              Center
            </Button>
          </div>
        )}

        {tree != null && (
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
            node={(
              <Node rx={8} ry={8} style={{ fill: 'var(--color-neutral-800)', stroke: 'var(--color-neutral-500)', strokeWidth: 2 }} >
                {(node) => (
                  <foreignObject width={node.width} height={node.height} x={0} y={0}>
                    <div className='w-full h-full px-4 py-1 flex flex-col justify-center leading-snug text-sm'>
                      <div className='text-neutral-400'>
                        {getNodeType(node.node)}
                      </div>
                      <div className='text-white whitespace-nowrap text-ellipsis overflow-hidden'>
                        {getNodeLabel(node.node)}
                      </div>
                    </div>
                  </foreignObject>
                )}
              </Node>
            )}
            // eslint-disable-next-line react/no-unstable-nested-components
            edge={(edge) => (
              <Edge
                style={{
                  stroke: 'var(--color-neutral-500)',
                  strokeWidth: 2,
                  strokeDasharray: (edge as EdgeData<MixerEdgeData>).data?.unconnected === true ? '2 4' : undefined
                }}
              />
            )}
            arrow={(
              <MarkerArrow size={4} style={{ fill: 'var(--color-neutral-500)' }} />
            )}
          />
        )}
      </div>

      <Footer>
        <div className={clsx('flex-1', instrumentCount == null && 'text-rose-400')}>
          {instrumentCount != null && busCount != null && routingCount != null && (
            <div>
              {`${pluralize(instrumentCount, 'instrument')}, ${pluralize(busCount, 'bus')}, ${pluralize(routingCount, 'routing')}`}
            </div>
          )}
          {instrumentCount == null && (
            <div>
              Program not available
            </div>
          )}
        </div>
      </Footer>
    </div>
  )
}
