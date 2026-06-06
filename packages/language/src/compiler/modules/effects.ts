import type { Effect } from '@core'
import { numeric } from '@utility'
import { NumberFacet } from '../../type-system/base/number.js'
import { RecordFacet } from '../../type-system/base/record.js'
import { EffectFacet } from '../../type-system/domain/effect.js'
import { ParameterFacet } from '../../type-system/domain/parameter.js'
import { makeType, makeUnion } from '../../type-system/factory.js'
import type { Value } from '../../type-system/types.js'
import type { FunctionContext } from '../functions.js'
import { allocateParameter } from '../functions.js'
import { Functions, Modules, Parameters } from '../type-helpers.js'

const UNITY_GAIN = numeric('db', 0)

// types

const GainEffectType = makeType(EffectFacet, RecordFacet.with({
  gain: ParameterFacet.with('db').type()
}))

const PanEffectType = makeType(EffectFacet, RecordFacet.with({
  pan: ParameterFacet.with(undefined).type()
}))

const LowpassEffectType = makeType(EffectFacet, RecordFacet.with({
  frequency: ParameterFacet.with('hz').type()
}))

const HighpassEffectType = makeType(EffectFacet, RecordFacet.with({
  frequency: ParameterFacet.with('hz').type()
}))

const WidthEffectType = makeType(EffectFacet)

const DelayEffectType = makeType(EffectFacet, RecordFacet.with({
  feedback: ParameterFacet.with(undefined).type()
}))

const ReverbEffectType = makeType(EffectFacet)

// factories

const gain = Functions.of({
  summary: 'Applies a gain adjustment to the signal.',

  parameters: [
    { name: 'gain', type: NumberFacet.with('db').type(), required: true }
  ],

  returnType: GainEffectType,

  invoke: (context, args) => {
    const effect: Effect = {
      type: 'gain',
      gain: allocateParameter(context as FunctionContext, NumberFacet.get(args.gain))
    }

    return GainEffectType.of(effect, {
      gain: Parameters.of(effect.gain)
    })
  }
})

const pan = Functions.of({
  summary: 'Places the signal in the stereo field.',

  parameters: [
    { name: 'pan', type: NumberFacet.with(undefined).type(), required: true }
  ],

  returnType: PanEffectType,

  invoke: (context, args) => {
    const effect: Effect = {
      type: 'pan',
      pan: allocateParameter(context as FunctionContext, NumberFacet.get(args.pan))
    }

    return PanEffectType.of(effect, {
      pan: Parameters.of(effect.pan)
    })
  }
})

const lowpass = Functions.of({
  summary: 'Filters out frequencies above the cutoff.',

  parameters: [
    { name: 'frequency', type: NumberFacet.with('hz').type(), required: true }
  ],

  returnType: LowpassEffectType,

  invoke: (context, args) => {
    const effect: Effect = {
      type: 'lowpass',
      frequency: allocateParameter(context as FunctionContext, NumberFacet.get(args.frequency))
    }

    return LowpassEffectType.of(effect, {
      frequency: Parameters.of(effect.frequency)
    })
  }
})

const highpass = Functions.of({
  summary: 'Filters out frequencies below the cutoff.',

  parameters: [
    { name: 'frequency', type: NumberFacet.with('hz').type(), required: true }
  ],

  returnType: HighpassEffectType,

  invoke: (context, args) => {
    const effect: Effect = {
      type: 'highpass',
      frequency: allocateParameter(context as FunctionContext, NumberFacet.get(args.frequency))
    }

    return HighpassEffectType.of(effect, {
      frequency: Parameters.of(effect.frequency)
    })
  }
})

const width = Functions.of({
  summary: 'Adjusts the stereo width of the signal.',

  parameters: [
    { name: 'width', type: NumberFacet.with(undefined).type(), required: true }
  ],

  returnType: WidthEffectType,

  invoke: (context, args) => {
    const effect: Effect = {
      type: 'width',
      width: NumberFacet.get(args.width)
    }

    return WidthEffectType.of(effect)
  }
})

const delay = Functions.of({
  summary: 'Adds echoes with configurable mix, time, and feedback.',

  parameters: [
    { name: 'mix', type: NumberFacet.with(undefined).type(), required: true },
    { name: 'time', type: makeUnion(NumberFacet.with('beats').type(), NumberFacet.with('s').type()), required: true },
    { name: 'feedback', type: NumberFacet.with(undefined).type(), required: true },
    { name: 'wet', type: NumberFacet.with('db').type(), required: false }
  ],

  returnType: DelayEffectType,

  invoke: (context, args) => {
    const effect: Effect = {
      type: 'delay',
      mix: NumberFacet.get(args.mix),
      time: NumberFacet.get(args.time),
      feedback: allocateParameter(context as FunctionContext, NumberFacet.get(args.feedback)),
      wet: args.wet != null ? NumberFacet.get(args.wet) : UNITY_GAIN
    }

    return DelayEffectType.of(effect, {
      feedback: Parameters.of(effect.feedback)
    })
  }
})

const reverb = Functions.of({
  summary: 'Adds reverberation with configurable mix and decay.',

  parameters: [
    { name: 'mix', type: NumberFacet.with(undefined).type(), required: true },
    { name: 'decay', type: makeUnion(NumberFacet.with('beats').type(), NumberFacet.with('s').type()), required: true },
    { name: 'wet', type: NumberFacet.with('db').type(), required: false }
  ],

  returnType: ReverbEffectType,

  invoke: (context, args) => {
    const effect: Effect = {
      type: 'reverb',
      mix: NumberFacet.get(args.mix),
      decay: NumberFacet.get(args.decay),
      wet: args.wet != null ? NumberFacet.get(args.wet) : UNITY_GAIN
    }

    return ReverbEffectType.of(effect)
  }
})

// module

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
