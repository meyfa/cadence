import type { FunctionComponent } from 'react'
import type { LayoutEdge } from '../layout.js'
import { getMarkerKey } from '../markers.js'
import type { FlowEdgeStyle } from '../types.js'

export const FlowchartEdge: FunctionComponent<{
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
