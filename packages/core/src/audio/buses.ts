import { Gain, type ToneAudioNode } from 'tone'
import type { BusId, Program } from '../program.js'

export function createBuses (program: Program): ReadonlyMap<BusId, ToneAudioNode> {
  const buses = new Map<BusId, ToneAudioNode>()

  for (const bus of program.mixer.buses) {
    const node = new Gain(bus.gain?.value, 'decibels')
    buses.set(bus.id, node)
  }

  const unrouted = new Set<BusId>(buses.keys())

  for (const routing of program.mixer.routings) {
    if (routing.source.type !== 'Bus') {
      continue
    }

    const source = buses.get(routing.source.id)
    const destination = buses.get(routing.destination.id)
    if (source != null && destination != null) {
      source.connect(destination)
    }

    unrouted.delete(routing.source.id)
  }

  for (const id of unrouted) {
    buses.get(id)?.toDestination()
  }

  return buses
}
