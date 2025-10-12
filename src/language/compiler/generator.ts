import { withPatternLength } from '../../core/pattern.js'
import { makeNumeric, type Instrument, type InstrumentId, type Numeric, type Program, type Routing, type Section, type Track, type Unit } from '../../core/program.js'
import * as ast from '../parser/ast.js'
import { trackSchema } from './common.js'
import { CompileError } from './error.js'
import { getDefaultFunctions, type FunctionDefinition } from './functions.js'
import type { InferSchema, PropertySchema } from './schema.js'
import { toNumberValue } from './units.js'
import { asInstrument, asNumber, asPattern, makeNumber, makePattern, makeString, type Value } from './values.js'

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
  readonly functions: ReadonlyMap<string, FunctionDefinition>

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
    functions: getDefaultFunctions(),
    resolutions: new Map(),
    instruments: new Map()
  }

  processAssignments(context, program)

  const track = program.tracks.length > 0
    ? generateTrack(context, program.tracks[0])
    : {
        tempo: makeNumeric('bpm', options.tempo.default),
        sections: []
      }

  return {
    beatsPerBar: options.beatsPerBar,
    stepsPerBeat: options.stepsPerBeat,
    instruments: context.instruments,
    track
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

function processAssignments (context: Context, program: ast.Program): void {
  for (const assignment of program.assignments) {
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

  return {
    tempo,
    sections
  }
}

function generateSection (context: Context, section: ast.SectionStatement): Section {
  const name = section.name.name
  const length = asNumber('steps', resolve(context, section.length))

  const routings = section.routings.map((routing): Routing => {
    const instrument = asInstrument(nonNull(context.resolutions.get(routing.instrument.name)))
    const pattern = asPattern(resolve(context, routing.pattern))

    return {
      instrumentId: instrument.value.id,
      pattern: pattern.value
    }
  })

  return { name, length: length.value, routings }
}

/**
 * Resolve an expression to a value within the given context. Since this expression (or sub-expressions) may call
 * functions, the context may be updated.
 */
function resolve (context: Context, expression: ast.Expression): Value {
  switch (expression.type) {
    case 'StringLiteral':
      return makeString(expression.value)

    case 'NumberLiteral':
      return toNumberValue(context.options, expression)

    case 'PatternLiteral':
      return makePattern(expression.value)

    case 'Identifier':
      return nonNull(context.resolutions.get(expression.name))

    case 'Call': {
      const func = nonNull(context.functions.get(expression.callee.name))
      const args = resolveProperties(context, expression.arguments, func.arguments)
      return func.invoke(context, args)
    }

    case 'BinaryExpression': {
      const left = resolve(context, expression.left)
      const right = resolve(context, expression.right)
      return computeBinaryExpression(expression.operator, left, right)
    }
  }
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
  if (left.type === 'String' && right.type === 'String') {
    return makeString(left.value + right.value)
  }

  if (left.type === 'Pattern' && right.type === 'Pattern') {
    return makePattern([...left.value, ...right.value])
  }

  if (left.type === 'Number' && right.type === 'Number') {
    return makeNumber(left.value.unit, left.value.value + right.value.value)
  }

  assert(false)
}

function computeMinus (left: Value, right: Value): Value {
  if (left.type === 'Number' && right.type === 'Number') {
    return makeNumber(left.value.unit, left.value.value - right.value.value)
  }

  assert(false)
}

function computeMultiply (left: Value, right: Value): Value {
  if (left.type === 'Number' && right.type === 'Number') {
    return makeNumber(left.value.unit ?? right.value.unit, left.value.value * right.value.value)
  }

  if (left.type === 'Pattern' && right.type === 'Number' && right.value.unit == null) {
    return makePattern(withPatternLength(left.value, left.value.length * right.value.value))
  }

  if (left.type === 'Number' && left.value.unit == null && right.type === 'Pattern') {
    return makePattern(withPatternLength(right.value, right.value.length * left.value.value))
  }

  assert(false)
}

function computeDivide (left: Value, right: Value): Value {
  if (left.type === 'Number' && right.type === 'Number') {
    // Equal units cancel out
    const unit = left.value.unit === right.value.unit ? undefined : left.value.unit
    return makeNumber(unit, left.value.value / right.value.value)
  }

  if (left.type === 'Pattern' && right.type === 'Number') {
    return makePattern(withPatternLength(left.value, left.value.length / right.value.value))
  }

  assert(false)
}

function resolveProperties<S extends PropertySchema> (context: Context, properties: readonly ast.Property[], schema: S): InferSchema<S> {
  const allowed = new Set(schema.map((s) => s.name))
  const values = properties
    .filter((p) => allowed.has(p.key.name))
    .map(({ key, value }) => [key.name, resolve(context, value).value])

  return Object.fromEntries(values) as InferSchema<S>
}
