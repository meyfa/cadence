import type { Effect } from '@core/program.js'
import type { PropertySchema } from '../schema.js'
import { EffectType, FunctionType, ModuleType, NumberType, type Value } from '../types.js'

// Factory

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
const createEffectConstructor = <T extends Effect>(type: T['type'], schema: PropertySchema) => {
  return FunctionType.of({
    arguments: schema,
    returnType: EffectType,
    invoke: (context, args) => EffectType.of({ ...args, type } as T)
  })
}

// Effects

const gain = createEffectConstructor('gain', [
  { name: 'gain', type: NumberType.with('db'), required: true }
])

const pan = createEffectConstructor('pan', [
  { name: 'pan', type: NumberType.with(undefined), required: true }
])

const lowpass = createEffectConstructor('lowpass', [
  { name: 'frequency', type: NumberType.with('hz'), required: true }
])

const highpass = createEffectConstructor('highpass', [
  { name: 'frequency', type: NumberType.with('hz'), required: true }
])

const delay = createEffectConstructor('delay', [
  { name: 'time', type: NumberType.with('beats'), required: true },
  { name: 'feedback', type: NumberType.with(undefined), required: true }
])

const reverb = createEffectConstructor('reverb', [
  { name: 'decay', type: NumberType.with('s'), required: true },
  { name: 'mix', type: NumberType.with(undefined), required: true }
])

export const effectsModule = ModuleType.of({
  name: 'effects',

  exports: new Map<string, Value>([
    ['gain', gain],
    ['pan', pan],
    ['lowpass', lowpass],
    ['highpass', highpass],
    ['delay', delay],
    ['reverb', reverb]
  ])
})
