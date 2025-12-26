import type { FlowEdgeStyle } from '../types.js'

const DEFAULT_EDGE_STYLE = Object.freeze({
  stroke: '#000',
  strokeWidth: 2,
  strokeDasharray: undefined,
  markerEnd: undefined
})

export function getEdgeStyle (...overrides: ReadonlyArray<Partial<FlowEdgeStyle> | undefined>): FlowEdgeStyle {
  return Object.assign({}, DEFAULT_EDGE_STYLE, ...overrides)
}
