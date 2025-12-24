import { useMemo, type ReactElement } from 'react'
import { computeLayout } from './layout.js'
import { getMarkerKey, getMarkerPath } from './markers.js'
import { getEdgeStyle } from './style.js'
import { FlowEdgeId, type FlowEdge, type FlowEdgeStyle, type FlowNode, type Marker, type RenderFlowNode } from './types.js'

const LAYOUT_OPTIONS = Object.freeze({
  nodeSpacingX: 80,
  nodeSpacingY: 20
})

export interface FlowchartProps<TNodeData = unknown, TEdgeData = unknown> {
  readonly nodes: Array<FlowNode<TNodeData>>
  readonly edges: Array<FlowEdge<TEdgeData>>
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

  const resolvedEdgeStyle = useMemo<Map<FlowEdgeId, FlowEdgeStyle>>(() => {
    const map = new Map<FlowEdgeId, FlowEdgeStyle>()
    for (const edge of edges) {
      map.set(edge.id, getEdgeStyle(edge.style))
    }
    return map
  }, [edges])

  // Determine which markers are needed and with which colors.
  // This is required because markers do not inherit their fill color from the line's stroke,
  // and the CSS value "context-stroke" is not yet widely supported.
  type MarkerDefinition = Readonly<{ id: string, marker: Marker, stroke: string }>

  const markers = useMemo<MarkerDefinition[]>(() => {
    const markerDefinitions = new Map<string, MarkerDefinition>()

    for (const edge of edges) {
      const style = resolvedEdgeStyle.get(edge.id)
      if (style?.markerEnd == null) {
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
  }, [edges])

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
        >
          {renderNode(node.node)}
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

        {layout.edges.map((edge) => {
          const style = resolvedEdgeStyle.get(edge.edge.id) ?? getEdgeStyle(edge.edge.style)

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
        })}
      </svg>
    </div>
  )
}
