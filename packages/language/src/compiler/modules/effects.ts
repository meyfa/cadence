import type { Effect } from '@core'
import { NumberFacet } from '../../type-system/base/number.js'
import { makeUnion } from '../../type-system/factory.js'
import type { InferSchema, Schema } from '../../type-system/schema.js'
import type { Value } from '../../type-system/types.js'
import type { FunctionContext } from '../functions.js'
import { allocateParameter } from '../functions.js'
import { Functions, Modules } from '../type-helpers.js'
import { EffectFacet } from '../../type-system/domain/effect.js'

// Factory

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
const createEffectConstructor = <T extends Effect, const S extends Schema>(
  summary: string,
  schema: S,
  create: (context: FunctionContext, args: InferSchema<S>) => T
) => {
  return Functions.of({
    summary,
    parameters: schema,
    returnType: EffectFacet.type(),
    invoke: (context, args) => EffectFacet.type().of(create(context as FunctionContext, args))
  })
}

// Effects

const gain = createEffectConstructor('Applies a gain adjustment to the signal.', [
  { name: 'gain', type: NumberFacet.with('db').type(), required: true }
], (context, args) => ({
  type: 'gain',
  gain: allocateParameter(context, NumberFacet.get(args.gain))
}))

const pan = createEffectConstructor('Places the signal in the stereo field.', [
  { name: 'pan', type: NumberFacet.with(undefined).type(), required: true }
], (context, args) => ({
  type: 'pan',
  pan: allocateParameter(context, NumberFacet.get(args.pan))
}))

const lowpass = createEffectConstructor('Filters out frequencies above the cutoff.', [
  { name: 'frequency', type: NumberFacet.with('hz').type(), required: true }
], (context, args) => ({
  type: 'lowpass',
  frequency: allocateParameter(context, NumberFacet.get(args.frequency))
}))

const highpass = createEffectConstructor('Filters out frequencies below the cutoff.', [
  { name: 'frequency', type: NumberFacet.with('hz').type(), required: true }
], (context, args) => ({
  type: 'highpass',
  frequency: allocateParameter(context, NumberFacet.get(args.frequency))
}))

const width = createEffectConstructor('Adjusts the stereo width of the signal.', [
  { name: 'width', type: NumberFacet.with(undefined).type(), required: true }
], (context, args) => ({
  type: 'width',
  width: NumberFacet.get(args.width)
}))

const delay = createEffectConstructor('Adds echoes with configurable mix, time, and feedback.', [
  { name: 'mix', type: NumberFacet.with(undefined).type(), required: true },
  { name: 'time', type: makeUnion(NumberFacet.with('beats').type(), NumberFacet.with('s').type()), required: true },
  { name: 'feedback', type: NumberFacet.with(undefined).type(), required: true }
], (context, args) => ({
  type: 'delay',
  mix: NumberFacet.get(args.mix),
  time: NumberFacet.get(args.time),
  feedback: NumberFacet.get(args.feedback)
}))

const reverb = createEffectConstructor('Adds reverberation with configurable mix and decay.', [
  { name: 'mix', type: NumberFacet.with(undefined).type(), required: true },
  { name: 'decay', type: makeUnion(NumberFacet.with('beats').type(), NumberFacet.with('s').type()), required: true }
], (context, args) => ({
  type: 'reverb',
  mix: NumberFacet.get(args.mix),
  decay: NumberFacet.get(args.decay)
}))

export const effectsModule = Modules.of({
  name: 'effects',
  summary: 'Effect functions for shaping mixer bus audio.',

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
