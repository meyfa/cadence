import type { ComponentType } from 'react'

export interface RenderFlowNodeProps<TData = unknown> {
  readonly node: FlowNode<TData>
  readonly highlight: boolean
}

export type FlowNodeComponent<TData = unknown> = ComponentType<RenderFlowNodeProps<TData>>

export type FlowNodeId = string & { __brand: '@meyfa/cadence-flowchart:node-id' }
export type FlowEdgeId = string & { __brand: '@meyfa/cadence-flowchart:edge-id' }

export type Marker = 'arrow'

export interface FlowNode<TData = unknown> {
  readonly id: FlowNodeId
  readonly data: TData
  readonly width: number
  readonly height: number
}

export interface FlowEdge<TData = unknown> {
  readonly id: FlowEdgeId
  readonly from: FlowNodeId
  readonly to: FlowNodeId
  readonly data: TData
  readonly style?: FlowEdgeStyle
  readonly highlightStyle?: Partial<FlowEdgeStyle>
}

export interface FlowEdgeStyle {
  readonly stroke: string
  readonly strokeWidth: number
  readonly strokeDasharray?: string
  readonly markerEnd?: Marker
}
