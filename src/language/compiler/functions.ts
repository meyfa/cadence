import type { Instrument, InstrumentId } from '../../core/program.js'
import { CompileError } from '../error.js'
import { formatType, makeInstrument, typeOf, type TypeInfo, type Value, type ValueForType } from './values.js'

export interface FunctionDefinition {
  readonly arguments: ReadonlyMap<string, TypeInfo>
  readonly returnType: TypeInfo
  readonly invoke: (context: FunctionContext, args: FunctionArguments) => Value
}

export interface FunctionContext {
  readonly instruments: Map<InstrumentId, Instrument>
}

export class FunctionArguments {
  constructor (
    private readonly args: ReadonlyMap<string, Value>
  ) {}

  get<T extends Value['type']> (name: string, type: T): ValueForType<T> {
    const value = this.args.get(name)

    if (value == null) {
      throw new CompileError(`Invalid access to undefined function argument "${name}"`)
    }

    if (value.type !== type) {
      const actualType = formatType(typeOf(value))
      throw new CompileError(`Invalid access to function argument "${name}" of type ${actualType}`)
    }

    return value as ValueForType<T>
  }
}

const sample: FunctionDefinition = {
  arguments: new Map([
    ['url', { type: 'String' }]
  ]),

  returnType: { type: 'Instrument' },

  invoke: (context, args) => {
    const currentMaxId = Math.max(0, ...Array.from(context.instruments.keys()))
    const instrument = makeInstrument({
      id: (currentMaxId + 1) as InstrumentId,
      sampleUrl: args.get('url', 'String').value
    })

    context.instruments.set(instrument.value.id, instrument.value)

    return instrument
  }
}

export function getDefaultFunctions (): ReadonlyMap<string, FunctionDefinition> {
  const functions = new Map<string, FunctionDefinition>()
  functions.set('sample', sample)
  return functions
}
