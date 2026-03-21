import { numeric } from '@core/numeric.js'
import type { Bus, BusId, Effect, Program } from '@core/program.js'
import { createEffect } from './effects.js'
import type { Instance } from './instances.js'
import type { Transport } from './transport.js'

const UNITY_GAIN = numeric('db', 0)

export function createBuses (transport: Transport, program: Program): ReadonlyMap<BusId, Instance> {
  return new Map(
    program.mixer.buses.map((bus) => [bus.id, createBus(transport, program, bus)])
  )
}

function createBus (transport: Transport, program: Program, bus: Bus): Instance {
  const effects: Instance[] = []
  const promises: Array<Promise<void>> = []

  const appendEffect = (effect: Effect) => {
    const instance = createEffect(transport, program, effect)

    const last = effects.at(-1)
    if (last != null && instance.input != null) {
      last.output?.connect(instance.input)
    }

    effects.push(instance)
    promises.push(instance.loaded)
  }

  for (const effect of bus.effects) {
    appendEffect(effect)
  }

  if (bus.pan != null) {
    appendEffect({ type: 'pan', pan: bus.pan })
  }

  // ensure there is always at least one node
  if (bus.gain != null || effects.length === 0) {
    appendEffect({ type: 'gain', gain: bus.gain ?? UNITY_GAIN })
  }

  const first = effects.at(0)
  const last = effects.at(-1)

  if (first == null || last == null) {
    throw new Error()
  }

  return {
    loaded: Promise.all(promises).then(() => undefined),
    dispose: () => effects.forEach((item) => item.dispose()),
    input: first.input,
    output: last.output
  }
}
