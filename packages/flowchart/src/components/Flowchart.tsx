import type { ReactElement } from 'react'
import { useLayoutEffect, useMemo, useState } from 'react'
import type { Layout } from '../layout.ts'
import { computeLayout } from '../layout.ts'
import { getMarkerKey, getMarkerPath } from '../markers.ts'
import { getEdgeStyle } from '../style.ts'
import type { FlowEdge, FlowEdgeId, FlowEdgeStyle, FlowNode, FlowNodeComponent, FlowNodeId, Marker } from '../types.ts'
import { FlowchartEdge } from './FlowchartEdge.tsx'

const LAYOUT_OPTIONS = Object.freeze({
  nodeSpacingX: 80,
  nodeSpacingY: 20
})

export interface FlowchartProps<TNodeData = unknown, TEdgeData = unknown> {
  readonly nodes: ReadonlyArray<FlowNode<TNodeData>>
  readonly edges: ReadonlyArray<FlowEdge<TEdgeData>>
  readonly NodeComponent: FlowNodeComponent<TNodeData>
}

export function Flowchart<TNodeData = unknown, TEdgeData = unknown> ({
  nodes,
  edges,
  NodeComponent
}: FlowchartProps<TNodeData, TEdgeData>): ReactElement {
  const layout = useMemo(() => {
    return computeLayout(nodes, edges, LAYOUT_OPTIONS)
  }, [nodes, edges])

  const [hoveredNodeId, setHoveredNodeId] = useState<FlowNodeId | undefined>(undefined)

  // Clear hovered node ID if the node is removed.
  useLayoutEffect(() => {
    setHoveredNodeId((current) => {
      if (current != null && nodes.some((node) => node.id === current)) {
        return current
      }
      return undefined
    })
  }, [nodes])

  const [highlightNodes, highlightEdges] = useMemo(() => {
    const highlightNodes = new Set<FlowNodeId>()
    const highlightEdges = new Set<FlowEdgeId>()

    const explore = (nodeId: FlowNodeId) => {
      if (!highlightNodes.has(nodeId)) {
        highlightNodes.add(nodeId)
        for (const edge of layout.connections.outgoing.get(nodeId) ?? []) {
          highlightEdges.add(edge.id)
          explore(edge.to)
        }
      }
    }

    if (hoveredNodeId != null) {
      explore(hoveredNodeId)
    }

    return [highlightNodes, highlightEdges]
  }, [hoveredNodeId, layout.connections])

  const resolvedEdgeStyle = useMemo<Map<FlowEdgeId, FlowEdgeStyle>>(() => {
    const map = new Map<FlowEdgeId, FlowEdgeStyle>()

    for (const edge of edges) {
      const style = getEdgeStyle(edge.style, highlightEdges.has(edge.id) ? edge.highlightStyle : undefined)
      map.set(edge.id, style)
    }

    return map
  }, [edges, highlightEdges])

  return (
    <div className='relative' style={{ width: layout.totalWidth, height: layout.totalHeight }}>
      <FlowchartNodes
        layout={layout}
        highlightNodes={highlightNodes}
        onHover={setHoveredNodeId}
        NodeComponent={NodeComponent}
      />

      <FlowchartEdges
        layout={layout}
        highlightEdges={highlightEdges}
        resolvedEdgeStyle={resolvedEdgeStyle}
      />
    </div>
  )
}

interface FlowchartNodesProps<TNodeData> {
  readonly layout: Layout<TNodeData>
  readonly highlightNodes: ReadonlySet<FlowNodeId>
  readonly onHover: (hoveredNodeId: FlowNodeId | undefined) => void
  readonly NodeComponent: FlowNodeComponent<TNodeData>
}

function FlowchartNodes<TNodeData> ({ layout, highlightNodes, onHover, NodeComponent }: FlowchartNodesProps<TNodeData>): ReactElement {
  return (
    <>
      {layout.nodes.map((node) => (
        <div
          key={node.node.id}
          style={{
            position: 'absolute',
            left: node.x,
            top: node.y,
            width: node.node.width,
            height: node.node.height
          }}
          onMouseEnter={() => onHover(node.node.id)}
          onMouseLeave={() => onHover(undefined)}
        >
          <NodeComponent node={node.node} highlight={highlightNodes.has(node.node.id)} />
        </div>
      ))}
    </>
  )
}

interface MarkerDefinition {
  readonly id: string
  readonly marker: Marker
  readonly stroke: string
}

interface FlowchartEdgesProps<TEdgeData> {
  readonly layout: Layout<unknown, TEdgeData>
  readonly highlightEdges: ReadonlySet<FlowEdgeId>
  readonly resolvedEdgeStyle: ReadonlyMap<FlowEdgeId, FlowEdgeStyle>
}

function FlowchartEdges<TEdgeData> ({ layout, highlightEdges, resolvedEdgeStyle }: FlowchartEdgesProps<TEdgeData>): ReactElement {
  // Markers need explicit colors because SVG markers do not inherit the line's stroke.
  const markers = useMemo<readonly MarkerDefinition[]>(() => {
    const markerDefinitions = new Map<string, MarkerDefinition>()

    for (const style of resolvedEdgeStyle.values()) {
      if (style.markerEnd == null) {
        continue
      }

      const key = getMarkerKey({ marker: style.markerEnd, stroke: style.stroke })
      if (markerDefinitions.has(key)) {
        continue
      }

      markerDefinitions.set(key, {
        id: key,
        marker: style.markerEnd,
        stroke: style.stroke
      })
    }

    return Array.from(markerDefinitions.values())
  }, [resolvedEdgeStyle])

  const renderEdges = (highlighted: boolean) => {
    return layout.edges
      .filter(({ edge }) => highlightEdges.has(edge.id) === highlighted)
      .map((edge) => {
        const style = resolvedEdgeStyle.get(edge.edge.id)
        return style != null ? <FlowchartEdge key={edge.edge.id} edge={edge} style={style} /> : null
      })
  }

  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible'
      }}
    >
      <defs>
        {markers.map((marker) => (
          <marker
            key={marker.id}
            id={marker.id}
            markerWidth='5'
            markerHeight='5'
            refX='5'
            refY='2.5'
            orient='auto'
            markerUnits='strokeWidth'
          >
            <path d={getMarkerPath(marker.marker)} fill={marker.stroke} />
          </marker>
        ))}
      </defs>
      {renderEdges(false)}
      {highlightEdges.size > 0 && renderEdges(true)}
    </svg>
  )
}
