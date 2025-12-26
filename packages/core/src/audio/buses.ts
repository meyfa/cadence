import { connectSeries, FeedbackDelay, Gain, Reverb, type ToneAudioNode } from 'tone'
import type { BusId, Effect, Program } from '../program.js'
import { stepsToSeconds } from './time.js'

export interface BusNodes {
  readonly input: ToneAudioNode
  readonly output: ToneAudioNode

  readonly dispose: () => void
}

export type BusesReturn = [buses: ReadonlyMap<BusId, BusNodes>, loaded: Promise<void>]

export function createBuses (program: Program): BusesReturn {
  const busNodes = new Map<BusId, BusNodes>()
  const promises: Array<Promise<any>> = []

  for (const bus of program.mixer.buses) {
    const nodes: ToneAudioNode[] = []

    for (const effect of bus.effects) {
      const [effectNode, effectLoaded] = createEffect(program, effect)
      nodes.push(effectNode)
      promises.push(effectLoaded)
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

  return [busNodes, Promise.allSettled(promises).then(() => undefined)]
}

function createEffect (program: Program, effect: Effect): [ToneAudioNode, Promise<void>] {
  switch (effect.type) {
    case 'delay': {
      return [
        new FeedbackDelay({
          delayTime: stepsToSeconds(effect.time, program.track.tempo, program.stepsPerBeat).value,
          feedback: Math.max(0, Math.min(1.0, effect.feedback.value))
        }),
        Promise.resolve()
      ]
    }

    case 'reverb': {
      const reverb = new Reverb({
        decay: effect.decay.value,
        wet: Math.max(0, Math.min(1.0, effect.mix.value))
      })
      return [reverb, reverb.generate().then(() => undefined)]
    }
  }
}
