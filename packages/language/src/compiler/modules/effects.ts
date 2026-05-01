import type { Effect } from '@core'
import type { FunctionContext } from '../functions.js'
import { allocateParameter } from '../functions.js'
import type { InferSchema, PropertySchema } from '../schema.js'
import type { Value } from '../types.js'
import { EffectType, FunctionType, ModuleType, NumberType } from '../types.js'

// Factory

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
const createEffectConstructor = <T extends Effect, const S extends PropertySchema>(
  schema: S,
  create: (context: FunctionContext, args: InferSchema<S>) => T
) => {
  return FunctionType.of({
    arguments: schema,
    returnType: EffectType,
    invoke: (context, args) => EffectType.of(create(context, args))
  })
}

// Effects

const gain = createEffectConstructor([
  { name: 'gain', type: NumberType.with('db'), required: true }
], (context, args) => ({
  type: 'gain',
  gain: allocateParameter(context, args.gain)
}))

const pan = createEffectConstructor([
  { name: 'pan', type: NumberType.with(undefined), required: true }
], (context, args) => ({
  type: 'pan',
  pan: args.pan
}))

const lowpass = createEffectConstructor([
  { name: 'frequency', type: NumberType.with('hz'), required: true }
], (context, args) => ({
  type: 'lowpass',
  frequency: args.frequency
}))

const highpass = createEffectConstructor([
  { name: 'frequency', type: NumberType.with('hz'), required: true }
], (context, args) => ({
  type: 'highpass',
  frequency: args.frequency
}))

const width = createEffectConstructor([
  { name: 'width', type: NumberType.with(undefined), required: true }
], (context, args) => ({
  type: 'width',
  width: args.width
}))

const delay = createEffectConstructor([
  { name: 'mix', type: NumberType.with(undefined), required: true },
  { name: 'time', type: [NumberType.with('beats'), NumberType.with('s')], required: true },
  { name: 'feedback', type: NumberType.with(undefined), required: true }
], (context, args) => ({
  type: 'delay',
  mix: args.mix,
  time: args.time,
  feedback: args.feedback
}))

const reverb = createEffectConstructor([
  { name: 'mix', type: NumberType.with(undefined), required: true },
  { name: 'decay', type: [NumberType.with('beats'), NumberType.with('s')], required: true }
], (context, args) => ({
  type: 'reverb',
  mix: args.mix,
  decay: args.decay
}))

export const effectsModule = ModuleType.of({
  name: 'effects',

  exports: new Map<string, Value>([
    ['gain', gain],
    ['pan', pan],
    ['lowpass', lowpass],
    ['highpass', highpass],
    ['width', width],
    ['delay', delay],
    ['reverb', reverb]
  ])
})
