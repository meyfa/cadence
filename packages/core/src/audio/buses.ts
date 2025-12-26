import { connectSeries, FeedbackDelay, Gain, type ToneAudioNode } from 'tone'
import type { BusId, Effect, Program } from '../program.js'
import { stepsToSeconds } from './time.js'

export interface BusNodes {
  readonly input: ToneAudioNode
  readonly output: ToneAudioNode

  readonly dispose: () => void
}

export function createBuses (program: Program): ReadonlyMap<BusId, BusNodes> {
  const busNodes = new Map<BusId, BusNodes>()

  for (const bus of program.mixer.buses) {
    const nodes: ToneAudioNode[] = []

    for (const effect of bus.effects) {
      nodes.push(createEffect(program, effect))
    }

    nodes.push(new Gain(bus.gain?.value, 'decibels'))

    const output = nodes.at(-1)
    if (output == null) {
      throw new Error()
    }

    connectSeries(...nodes)

    busNodes.set(bus.id, {
      input: nodes[0],
      output,
      dispose: () => nodes.forEach((node) => node.dispose())
    })
  }

  const unrouted = new Set<BusId>(busNodes.keys())

  for (const routing of program.mixer.routings) {
    if (routing.source.type !== 'Bus') {
      continue
    }

    const source = busNodes.get(routing.source.id)?.output
    const destination = busNodes.get(routing.destination.id)?.input

    if (source != null && destination != null) {
      source.connect(destination)
    }

    unrouted.delete(routing.source.id)
  }

  for (const id of unrouted) {
    busNodes.get(id)?.output.toDestination()
  }

  return busNodes
}

function createEffect (program: Program, effect: Effect): ToneAudioNode {
  switch (effect.type) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    case 'delay':
      return new FeedbackDelay({
        delayTime: stepsToSeconds(effect.time, program.track.tempo, program.stepsPerBeat).value,
        feedback: Math.max(0, Math.min(1.0, effect.feedback.value))
      })
  }
}
