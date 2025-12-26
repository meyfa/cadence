import type { Marker } from '../types.js'

const markerPaths: Record<Marker, string> = {
  arrow: 'M0,0 L0,5 L5,2.5 Z'
}

export function getMarkerPath (marker: Marker): string {
  return markerPaths[marker]
}

export function getMarkerKey (props: {
  marker: Marker
  stroke: string
}): string {
  return `${props.marker}-${props.stroke}`
}
