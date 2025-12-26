import { useLayoutEffect, useMemo, useState, type FunctionComponent, type ReactElement } from 'react'
import { computeLayout, type LayoutEdge } from './internal/layout.js'
import { getMarkerKey, getMarkerPath } from './internal/markers.js'
import { getEdgeStyle } from './internal/style.js'
import { FlowEdgeId, type FlowEdge, type FlowEdgeStyle, type FlowNode, type FlowNodeId, type Marker, type RenderFlowNode } from './types.js'

const LAYOUT_OPTIONS = Object.freeze({
  nodeSpacingX: 80,
  nodeSpacingY: 20
})

export interface FlowchartProps<TNodeData = unknown, TEdgeData = unknown> {
  readonly nodes: ReadonlyArray<FlowNode<TNodeData>>
  readonly edges: ReadonlyArray<FlowEdge<TEdgeData>>
  readonly renderNode: RenderFlowNode<TNodeData>
}

export function Flowchart<TNodeData = unknown, TEdgeData = unknown> ({
  nodes,
  edges,
  renderNode
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

  // Determine which markers are needed and with which colors.
  // This is required because markers do not inherit their fill color from the line's stroke,
  // and the CSS value "context-stroke" is not yet widely supported.
  type MarkerDefinition = Readonly<{ id: string, marker: Marker, stroke: string }>

  const markers = useMemo<MarkerDefinition[]>(() => {
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

  return (
    <div className='relative' style={{ width: layout.totalWidth, height: layout.totalHeight }}>
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
          onMouseEnter={() => setHoveredNodeId(node.node.id)}
          onMouseLeave={() => setHoveredNodeId(undefined)}
        >
          {renderNode({ node: node.node, highlight: highlightNodes.has(node.node.id) })}
        </div>
      ))}

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

        {/* draw non-highlighted edges first */}
        {
          layout.edges
            .filter(({ edge }) => !highlightEdges.has(edge.id))
            .map((edge) => {
              const style = resolvedEdgeStyle.get(edge.edge.id)
              return style != null ? (<FlowchartEdge key={edge.edge.id} edge={edge} style={style} />) : null
            })
        }

        {/* draw highlighted edges on top */}
        {
          highlightEdges.size > 0 && layout.edges
            .filter(({ edge }) => highlightEdges.has(edge.id))
            .map((edge) => {
              const style = resolvedEdgeStyle.get(edge.edge.id)
              return style != null ? (<FlowchartEdge key={edge.edge.id} edge={edge} style={style} />) : null
            })
        }
      </svg>
    </div>
  )
}

const FlowchartEdge: FunctionComponent<{
  edge: LayoutEdge
  style: FlowEdgeStyle
}> = ({ edge, style }) => {
  const markerEnd = style.markerEnd != null
    ? `url(#${CSS.escape(getMarkerKey({ marker: style.markerEnd, stroke: style.stroke }))})`
    : undefined

  return (
    <path
      key={edge.edge.id}
      d={edge.path}
      style={{
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
        strokeDasharray: style.strokeDasharray,
        fill: 'none'
      }}
      markerEnd={markerEnd}
    />
  )
}
