import { makeNumeric, type Bus, type BusId, type Effect, type Program } from '@core/program.js'
import { createEffect } from './effects.js'
import { connect, type BusInstance, type EffectInstance } from './instances.js'

const UNITY_GAIN = makeNumeric('db', 0)

export function createBuses (ctx: BaseAudioContext, program: Program): ReadonlyMap<BusId, BusInstance> {
  return new Map(
    program.mixer.buses.map((bus) => [bus.id, createBus(ctx, program, bus)])
  )
}

function createBus (ctx: BaseAudioContext, program: Program, bus: Bus): BusInstance {
  const effects: EffectInstance[] = []
  const promises: Array<Promise<void>> = []

  const appendEffect = (effect: Effect) => {
    const instance = createEffect(ctx, program, effect)

    const last = effects.at(-1)
    if (last != null) {
      connect(last, instance)
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
    input: first.input,
    output: last.output,
    loaded: Promise.all(promises).then(() => undefined),
    dispose: () => effects.forEach((item) => item.dispose())
  }
}
