import { withPatternLength } from '@core/pattern.js'
import { makeNumeric, type Bus, type BusId, type Instrument, type InstrumentId, type InstrumentRouting, type Mixer, type MixerRouting, type Numeric, type Program, type Section, type Track, type Unit } from '@core/program.js'
import * as ast from '../parser/ast.js'
import { busSchema, trackSchema } from './common.js'
import { CompileError } from './error.js'
import { getDefaultFunctions } from './functions.js'
import type { InferSchema, PropertySchema } from './schema.js'
import { toNumberValue } from './units.js'
import { BusType, FunctionType, GroupType, InstrumentType, NumberType, PatternType, StringType, type BusValue, type GroupValue, type InstrumentValue, type Type, type Value } from './types.js'

export interface GenerateOptions {
  readonly beatsPerBar: number
  readonly stepsPerBeat: number

  readonly tempo: {
    readonly default: number
    readonly minimum: number
    readonly maximum: number
  }
}

interface Context {
  readonly options: GenerateOptions

  // Intentionally mutable to allow building up during generation
  readonly resolutions: Map<string, Value>
  readonly instruments: Map<InstrumentId, Instrument>
}

/**
 * Generate a runnable program from an AST. This assumes the AST has already been
 * semantically checked and is valid.
 */
export function generate (program: ast.Program, options: GenerateOptions): Program {
  const context: Context = {
    options,
    resolutions: new Map(getDefaultFunctions()),
    instruments: new Map()
  }

  const assignments = program.children.filter((c) => c.type === 'Assignment')
  const tracks = program.children.filter((c) => c.type === 'TrackStatement')
  const mixers = program.children.filter((c) => c.type === 'MixerStatement')

  processAssignments(context, assignments)

  const track = tracks.length > 0
    ? generateTrack(context, tracks[0])
    : {
        tempo: makeNumeric('bpm', options.tempo.default),
        sections: []
      }

  const mixer = mixers.length > 0
    ? generateMixer(context, mixers[0])
    : { buses: [], routings: [] }

  return {
    beatsPerBar: options.beatsPerBar,
    stepsPerBeat: options.stepsPerBeat,
    instruments: context.instruments,
    track,
    mixer
  }
}

function assert (condition: boolean): asserts condition {
  if (!condition) {
    throw new CompileError('Internal compiler error (should have been caught in semantic analysis)')
  }
}

function nonNull<T> (value: T | null | undefined): NonNullable<T> {
  assert(value != null)
  return value
}

function clamped<U extends Unit> (value: Numeric<U>, minimum: number, maximum: number): Numeric<U> {
  return value.value < minimum || value.value > maximum
    ? makeNumeric(value.unit, Math.min(Math.max(value.value, minimum), maximum))
    : value
}

function processAssignments (context: Context, assignments: readonly ast.Assignment[]): void {
  for (const assignment of assignments) {
    assert(!context.resolutions.has(assignment.key.name))
    context.resolutions.set(assignment.key.name, resolve(context, assignment.value))
  }
}

function generateTrack (context: Context, track: ast.TrackStatement): Track {
  const properties = resolveProperties(context, track.properties, trackSchema)

  const tempo = properties.tempo != null
    ? clamped(properties.tempo, context.options.tempo.minimum, context.options.tempo.maximum)
    : makeNumeric('bpm', context.options.tempo.default)

  const sections = track.sections.map((section) => generateSection(context, section))

  return { tempo, sections }
}

function generateSection (context: Context, section: ast.SectionStatement): Section {
  const name = section.name.name
  const length = NumberType.with('steps').cast(resolve(context, section.length))

  const routings = section.routings.map((routing): InstrumentRouting => {
    const source = PatternType.cast(resolve(context, routing.source))
    const instrument = InstrumentType.cast(nonNull(context.resolutions.get(routing.destination.name)))

    return {
      source: {
        type: 'Pattern',
        value: source.data
      },

      destination: {
        type: 'Instrument',
        id: instrument.data.id
      }
    }
  })

  return { name, length: length.data, routings }
}

function generateMixer (context: Context, mixer: ast.MixerStatement): Mixer {
  // Mixer has a local scope
  const mixerContext = { ...context, resolutions: new Map(context.resolutions) }

  const buses = mixer.buses.map((bus, index) => generateBus(mixerContext, bus, index as BusId))
  for (const bus of buses) {
    mixerContext.resolutions.set(bus.name, BusType.of(bus))
  }

  const routings = mixer.routings.flatMap((routing): MixerRouting[] => {
    const source = resolve(mixerContext, routing.source)
    const destination = nonNull(buses.find((b) => b.name === routing.destination.name))

    const toRouting = (src: { type: Type['name'], id: InstrumentId | BusId }): MixerRouting => ({
      source: src.type === 'instrument'
        ? { type: 'Instrument', id: src.id as InstrumentId }
        : { type: 'Bus', id: src.id as BusId },
      destination: { type: 'Bus', id: destination.id }
    })

    if (InstrumentType.is(source)) {
      return [toRouting({ type: InstrumentType.name, id: source.data.id })]
    }

    if (BusType.is(source)) {
      return [toRouting({ type: BusType.name, id: source.data.id })]
    }

    if (GroupType.is(source)) {
      return source.data.map((part) => toRouting({ type: part.type.name, id: part.data.id }))
    }

    assert(false)
  })

  return { buses, routings }
}

function generateBus (context: Context, bus: ast.BusStatement, id: BusId): Bus {
  const name = bus.name.name
  const { gain } = resolveProperties(context, bus.properties, busSchema)

  return { id, name, gain }
}

/**
 * Resolve an expression to a value within the given context. Since this expression (or sub-expressions) may call
 * functions, the context may be updated.
 */
function resolve (context: Context, expression: ast.Expression): Value {
  switch (expression.type) {
    case 'StringLiteral':
      return StringType.of(expression.value)

    case 'NumberLiteral':
      return toNumberValue(context.options, expression)

    case 'PatternLiteral':
      return PatternType.of(expression.value)

    case 'Identifier':
      return nonNull(context.resolutions.get(expression.name))

    case 'Call': {
      const func = FunctionType.cast(nonNull(context.resolutions.get(expression.callee.name)))
      const args = resolveProperties(context, expression.arguments, func.data.arguments)
      return func.data.invoke(context, args)
    }

    case 'UnaryExpression': {
      const arg = resolve(context, expression.argument)
      return computeUnaryExpression(expression.operator, arg)
    }

    case 'BinaryExpression': {
      const left = resolve(context, expression.left)
      const right = resolve(context, expression.right)
      return computeBinaryExpression(expression.operator, left, right)
    }
  }
}

function computeUnaryExpression (operator: ast.UnaryOperator, argument: Value): Value {
  switch (operator) {
    case '+':
      if (NumberType.is(argument)) {
        return argument
      }
      break

    case '-':
      if (NumberType.is(argument)) {
        return NumberType.of({ unit: argument.data.unit, value: -argument.data.value })
      }
      break
  }

  assert(false)
}

function computeBinaryExpression (operator: ast.BinaryOperator, left: Value, right: Value): Value {
  switch (operator) {
    case '+':
      return computePlus(left, right)
    case '-':
      return computeMinus(left, right)
    case '*':
      return computeMultiply(left, right)
    case '/':
      return computeDivide(left, right)
  }
}

function computePlus (left: Value, right: Value): Value {
  if (StringType.is(left) && StringType.is(right)) {
    return StringType.of(left.data + right.data)
  }

  if (PatternType.is(left) && PatternType.is(right)) {
    return PatternType.of([...left.data, ...right.data])
  }

  if (NumberType.is(left) && NumberType.is(right)) {
    return NumberType.of({ unit: left.data.unit, value: left.data.value + right.data.value })
  }

  type Summable = InstrumentValue | BusValue | GroupValue
  const isSummable = (value: Value) => InstrumentType.is(value) || BusType.is(value) || GroupType.is(value)
  const getSumComponents = (value: Summable) => GroupType.is(value) ? value.data : [value]

  if (isSummable(left) && isSummable(right)) {
    return GroupType.of([...getSumComponents(left), ...getSumComponents(right)])
  }

  assert(false)
}

function computeMinus (left: Value, right: Value): Value {
  if (NumberType.is(left) && NumberType.is(right)) {
    return NumberType.of({ unit: left.data.unit, value: left.data.value - right.data.value })
  }

  assert(false)
}

function computeMultiply (left: Value, right: Value): Value {
  if (NumberType.is(left) && NumberType.is(right)) {
    return NumberType.of({ unit: left.data.unit ?? right.data.unit, value: left.data.value * right.data.value })
  }

  if (PatternType.is(left) && NumberType.is(right)) {
    return PatternType.of(withPatternLength(left.data, left.data.length * right.data.value))
  }

  if (NumberType.is(left) && PatternType.is(right)) {
    return PatternType.of(withPatternLength(right.data, right.data.length * left.data.value))
  }

  assert(false)
}

function computeDivide (left: Value, right: Value): Value {
  if (NumberType.is(left) && NumberType.is(right)) {
    // Equal units cancel out
    const unit = left.data.unit === right.data.unit ? undefined : left.data.unit
    return NumberType.of({ unit, value: left.data.value / right.data.value })
  }

  if (PatternType.is(left) && NumberType.is(right)) {
    return PatternType.of(withPatternLength(left.data, left.data.length / right.data.value))
  }

  assert(false)
}

function resolveProperties<S extends PropertySchema> (context: Context, properties: readonly ast.Property[], schema: S): InferSchema<S> {
  const allowed = new Set(schema.map((s) => s.name))
  const values = properties
    .filter((p) => allowed.has(p.key.name))
    .map(({ key, value }) => [key.name, resolve(context, value).data])

  return Object.fromEntries(values) as InferSchema<S>
}
