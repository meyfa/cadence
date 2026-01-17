import { EffectType, FunctionType, ModuleType, NumberType, type Value } from '../types.js'

const gain = FunctionType.of({
  arguments: [
    { name: 'gain', type: NumberType.with('db'), required: true }
  ],

  returnType: EffectType,

  invoke: (context, { gain }) => {
    return EffectType.of({
      type: 'gain',
      gain
    })
  }
})

const pan = FunctionType.of({
  arguments: [
    { name: 'pan', type: NumberType.with(undefined), required: true }
  ],

  returnType: EffectType,

  invoke: (context, { pan }) => {
    return EffectType.of({
      type: 'pan',
      pan
    })
  }
})

const delay = FunctionType.of({
  arguments: [
    { name: 'time', type: NumberType.with('beats'), required: true },
    { name: 'feedback', type: NumberType.with(undefined), required: true }
  ],

  returnType: EffectType,

  invoke: (context, { time, feedback }) => {
    return EffectType.of({
      type: 'delay',
      time,
      feedback
    })
  }
})

const reverb = FunctionType.of({
  arguments: [
    { name: 'decay', type: NumberType.with('s'), required: true },
    { name: 'mix', type: NumberType.with(undefined), required: true }
  ],

  returnType: EffectType,

  invoke: (context, args) => {
    return EffectType.of({
      type: 'reverb',
      decay: args.decay,
      mix: args.mix
    })
  }
})

export const effectsModule = ModuleType.of({
  name: 'effects',

  exports: new Map<string, Value>([
    ['gain', gain],
    ['pan', pan],
    ['delay', delay],
    ['reverb', reverb]
  ])
})
