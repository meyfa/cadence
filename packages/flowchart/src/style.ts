import type { FlowEdgeStyle } from './types.js'

const DEFAULT_EDGE_STYLE = Object.freeze({
  stroke: '#000',
  strokeWidth: 2,
  strokeDasharray: undefined,
  markerEnd: undefined
})

export function getEdgeStyle (style: Partial<FlowEdgeStyle> | undefined): FlowEdgeStyle {
  if (style == null) {
    return DEFAULT_EDGE_STYLE
  }

  return {
    stroke: style.stroke ?? DEFAULT_EDGE_STYLE.stroke,
    strokeWidth: style.strokeWidth ?? DEFAULT_EDGE_STYLE.strokeWidth,
    strokeDasharray: style.strokeDasharray ?? DEFAULT_EDGE_STYLE.strokeDasharray,
    markerEnd: style.markerEnd ?? DEFAULT_EDGE_STYLE.markerEnd
  }
}
