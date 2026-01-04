import { CompileError } from './error.js'
import * as ast from '../parser/ast.js'
import { BusType, EffectType, FunctionType, GroupType, InstrumentType, NumberType, PatternType, StringType, type Type } from './types.js'
import { getDefaultFunctions } from './functions.js'
import type { SourceRange } from '../range.js'
import { toBaseUnit } from './units.js'
import type { PropertySchema, PropertySpec } from './schema.js'
import { busSchema, mixerSchema, sectionSchema, trackSchema } from './common.js'

interface Context {
  // Intentionally mutable to allow building up during checking
  readonly resolutions: Map<string, Type>
}

interface Checked<TValue> {
  readonly errors: readonly CompileError[]
  readonly result?: TValue
}

export function check (program: ast.Program): readonly CompileError[] {
  const context: Context = {
    resolutions: new Map([...getDefaultFunctions()].map(([name, fn]) => [name, fn.type]))
  }

  const assignments = program.children.filter((c) => c.type === 'Assignment')
  const tracks = program.children.filter((c) => c.type === 'TrackStatement')
  const mixers = program.children.filter((c) => c.type === 'MixerStatement')

  const errors = [
    ...checkAssignments(context, assignments),
    ...checkTracks(context, tracks),
    ...checkMixers(context, mixers)
  ]

  // Certain AST parser design decisions may result in the same error being reported multiple times.
  // For example: Routing "c << b << a" may be interpreted as two separate routings, both causing an unknown identifier error for "b".
  for (let i = errors.length - 1; i > 0; --i) {
    if (errors[i].equals(errors[i - 1])) {
      errors.pop()
    }
  }

  return errors
}

function checkType (options: readonly Type[], actual: Type, range?: SourceRange): readonly CompileError[] {
  if (!options.some((option) => option.equals(actual))) {
    const optionsText = options.map((o) => o.format()).join(' or ')
    return [new CompileError(`Expected type ${optionsText}, got ${actual.format()}`, range)]
  }

  return []
}

function checkAssignments (context: Context, assignments: readonly ast.Assignment[]): readonly CompileError[] {
  const errors: CompileError[] = []

  for (const assignment of assignments) {
    const duplicate = context.resolutions.has(assignment.key.name)
    if (duplicate) {
      errors.push(new CompileError(`Identifier "${assignment.key.name}" is already defined`, assignment.key.range))
    }

    const expressionCheck = checkExpression(context, assignment.value)
    errors.push(...expressionCheck.errors)

    if (!duplicate && expressionCheck.result != null) {
      context.resolutions.set(assignment.key.name, expressionCheck.result)
    }
  }

  return errors
}

function checkTracks (context: Context, tracks: readonly ast.TrackStatement[]): readonly CompileError[] {
  const errors: CompileError[] = []

  for (const track of tracks) {
    if (tracks.length > 1) {
      errors.push(new CompileError('Multiple track definitions', track.range))
    }

    errors.push(...checkTrack(context, track))
  }

  return errors
}

function checkTrack (context: Context, track: ast.TrackStatement): readonly CompileError[] {
  const errors: CompileError[] = []

  const propertiesCheck = checkProperties(context, track.properties, trackSchema, track.range)
  errors.push(...propertiesCheck.errors)

  const seenSections = new Set<string>()

  for (const section of track.sections) {
    if (seenSections.has(section.name.name)) {
      errors.push(new CompileError(`Duplicate section named "${section.name.name}"`, section.range))
    }
    if (context.resolutions.has(section.name.name)) {
      errors.push(new CompileError(`Section name "${section.name.name}" conflicts with existing identifier`, section.name.range))
    }
    seenSections.add(section.name.name)
    errors.push(...checkSection(context, section))
  }

  return errors
}

function checkSection (context: Context, section: ast.SectionStatement): readonly CompileError[] {
  const errors: CompileError[] = []

  const lengthCheck = checkExpression(context, section.length)
  errors.push(...lengthCheck.errors)

  if (lengthCheck.result != null) {
    errors.push(...checkType([NumberType.with('beats')], lengthCheck.result, section.length.range))
  }

  const propertiesCheck = checkProperties(context, section.properties, sectionSchema, section.range)
  errors.push(...propertiesCheck.errors)

  for (const routing of section.routings) {
    errors.push(...checkInstrumentRouting(context, routing))
  }

  return errors
}

function checkInstrumentRouting (context: Context, routing: ast.Routing): readonly CompileError[] {
  const errors: CompileError[] = []

  const destination = context.resolutions.get(routing.destination.name)
  if (destination == null) {
    errors.push(new CompileError(`Unknown identifier "${routing.destination.name}"`, routing.destination.range))
  } else {
    errors.push(...checkType([InstrumentType], destination, routing.destination.range))
  }

  const sourceCheck = checkExpression(context, routing.source)
  errors.push(...sourceCheck.errors)
  if (sourceCheck.result != null) {
    errors.push(...checkType([PatternType], sourceCheck.result, routing.source.range))
  }

  return errors
}

function checkMixers (context: Context, mixers: readonly ast.MixerStatement[]): readonly CompileError[] {
  const errors: CompileError[] = []

  for (const mixer of mixers) {
    if (mixers.length > 1) {
      errors.push(new CompileError('Multiple mixer definitions', mixer.range))
    }
    errors.push(...checkMixer(context, mixer))
  }

  return errors
}

function checkMixer (context: Context, mixer: ast.MixerStatement): readonly CompileError[] {
  // Mixer has a local scope
  const mixerContext = { ...context, resolutions: new Map(context.resolutions) }

  const errors: CompileError[] = []

  const propertiesCheck = checkProperties(mixerContext, mixer.properties, mixerSchema, mixer.range)
  errors.push(...propertiesCheck.errors)

  const seenBuses = new Set<string>()

  for (const bus of mixer.buses) {
    if (seenBuses.has(bus.name.name)) {
      errors.push(new CompileError(`Duplicate bus named "${bus.name.name}"`, bus.range))
    }
    seenBuses.add(bus.name.name)

    if (mixerContext.resolutions.has(bus.name.name)) {
      errors.push(new CompileError(`Bus name "${bus.name.name}" conflicts with existing identifier`, bus.name.range))
    }

    // Reserve the name in the local scope
    mixerContext.resolutions.set(bus.name.name, BusType)

    errors.push(...checkBus(mixerContext, bus))
  }

  // Process routings last so that all buses are known
  for (const routing of mixer.routings) {
    errors.push(...checkBusRouting(mixerContext, routing))
  }

  return errors
}

function checkBus (context: Context, bus: ast.BusStatement): readonly CompileError[] {
  const errors: CompileError[] = []

  const propertiesCheck = checkProperties(context, bus.properties, busSchema, bus.range)
  errors.push(...propertiesCheck.errors)

  for (const effect of bus.effects) {
    const effectCheck = checkExpression(context, effect.expression)
    errors.push(...effectCheck.errors)

    if (effectCheck.result != null) {
      errors.push(...checkType([EffectType], effectCheck.result, effect.expression.range))
    }
  }

  return errors
}

function checkBusRouting (context: Context, routing: ast.Routing): readonly CompileError[] {
  const errors: CompileError[] = []

  const destination = context.resolutions.get(routing.destination.name)
  if (destination == null) {
    errors.push(new CompileError(`Unknown identifier "${routing.destination.name}"`, routing.destination.range))
  } else {
    errors.push(...checkType([BusType], destination, routing.destination.range))
  }

  const sourceCheck = checkExpression(context, routing.source)
  errors.push(...sourceCheck.errors)
  if (sourceCheck.result != null) {
    const options = [InstrumentType, BusType, GroupType] as const
    errors.push(...checkType(options, sourceCheck.result, routing.source.range))
  }

  return errors
}

function checkExpression (context: Context, expression: ast.Expression): Checked<Type> {
  switch (expression.type) {
    case 'StringLiteral':
      return { errors: [], result: StringType }

    case 'NumberLiteral':
      return { errors: [], result: NumberType.with(toBaseUnit(expression.unit)) }

    case 'PatternLiteral':
      return { errors: [], result: PatternType }

    case 'Identifier': {
      const valueType = context.resolutions.get(expression.name)
      if (valueType == null) {
        return { errors: [new CompileError(`Unknown identifier "${expression.name}"`, expression.range)] }
      }
      return { errors: [], result: valueType }
    }

    case 'Call': {
      const callee = context.resolutions.get(expression.callee.name)
      if (callee == null) {
        return { errors: [new CompileError(`Unknown identifier "${expression.callee.name}"`, expression.range)] }
      }

      if (!FunctionType.equals(callee)) {
        return { errors: [new CompileError(`"${expression.callee.name}" is not a function`, expression.callee.range)] }
      }

      const { schema, returnType } = FunctionType.detail(callee)
      if (schema == null || returnType == null) {
        return { errors: [new CompileError(`Function "${expression.callee.name}" is missing type information`, expression.callee.range)] }
      }

      const { errors } = checkArguments(context, expression.arguments, schema, expression.range)
      return { errors, result: returnType }
    }

    case 'UnaryExpression': {
      const argumentCheck = checkExpression(context, expression.argument)

      if (argumentCheck.result == null) {
        return { errors: argumentCheck.errors }
      }

      return checkUnaryExpression(expression.operator, argumentCheck.result, expression.range)
    }

    case 'BinaryExpression': {
      const leftCheck = checkExpression(context, expression.left)
      const rightCheck = checkExpression(context, expression.right)

      const errors = [...leftCheck.errors, ...rightCheck.errors]

      if (leftCheck.result == null || rightCheck.result == null) {
        return { errors }
      }

      return checkBinaryExpression(expression.operator, leftCheck.result, rightCheck.result, expression.range)
    }
  }
}

function checkUnaryExpression (operator: ast.UnaryOperator, argument: Type, range: SourceRange): Checked<Type> {
  if (!NumberType.equals(argument)) {
    return { errors: [new CompileError(`Incompatible operand for "${operator}": ${argument.format()}`, range)] }
  }

  // TypeScript will error if an operator is not handled
  switch (operator) {
    case '+':
    case '-':
      return { errors: [], result: argument }
  }
}

function checkBinaryExpression (operator: ast.BinaryOperator, left: Type, right: Type, range: SourceRange): Checked<Type> {
  switch (operator) {
    case '+':
      return checkPlus(left, right, range)
    case '-':
      return checkMinus(left, right, range)
    case '*':
      return checkMultiply(left, right, range)
    case '/':
      return checkDivide(left, right, range)
  }
}

function checkPlus (left: Type, right: Type, range: SourceRange): Checked<Type> {
  if (StringType.equals(left) && StringType.equals(right)) {
    return { errors: [], result: left }
  }

  if (PatternType.equals(left) && PatternType.equals(right)) {
    return { errors: [], result: left }
  }

  if (NumberType.equals(left) && NumberType.equals(right) && left.equals(right)) {
    return { errors: [], result: left }
  }

  const isSummable = (type: Type) => InstrumentType.equals(type) || BusType.equals(type) || GroupType.equals(type)
  if (isSummable(left) && isSummable(right)) {
    return { errors: [], result: GroupType }
  }

  return { errors: [new CompileError(`Incompatible operands for "+": ${left.format()} and ${right.format()}`, range)] }
}

function checkMinus (left: Type, right: Type, range: SourceRange): Checked<Type> {
  if (NumberType.equals(left) && NumberType.equals(right) && left.equals(right)) {
    return { errors: [], result: left }
  }

  return { errors: [new CompileError(`Incompatible operands for "-": ${left.format()} and ${right.format()}`, range)] }
}

function checkMultiply (left: Type, right: Type, range: SourceRange): Checked<Type> {
  if (NumberType.equals(left) && NumberType.equals(right)) {
    const { unit: leftUnit } = NumberType.detail(left)
    const { unit: rightUnit } = NumberType.detail(right)
    if (leftUnit == null || rightUnit == null) {
      return { errors: [], result: NumberType.with(leftUnit ?? rightUnit) }
    }
  }

  if ((PatternType.equals(left) && NumberType.with(undefined).equals(right)) || (NumberType.with(undefined).equals(left) && PatternType.equals(right))) {
    return { errors: [], result: PatternType }
  }

  return { errors: [new CompileError(`Incompatible operands for "*": ${left.format()} and ${right.format()}`, range)] }
}

function checkDivide (left: Type, right: Type, range: SourceRange): Checked<Type> {
  if (NumberType.equals(left) && NumberType.equals(right)) {
    const { unit: leftUnit } = NumberType.detail(left)
    const { unit: rightUnit } = NumberType.detail(right)

    // equal units cancel out
    if (leftUnit === rightUnit) {
      return { errors: [], result: NumberType.with(undefined) }
    }

    if (rightUnit == null) {
      return { errors: [], result: left }
    }
  }

  if (PatternType.equals(left) && NumberType.with(undefined).equals(right)) {
    return { errors: [], result: left }
  }

  return { errors: [new CompileError(`Incompatible operands for "/": ${left.format()} and ${right.format()}`, range)] }
}

function checkProperties (context: Context, properties: readonly ast.Property[], schema: PropertySchema, parentRange?: SourceRange): Checked<ReadonlyMap<string, Type>> {
  const errors: CompileError[] = []
  const result = new Map<string, Type>()

  const schemaAsMap = new Map<string, PropertySpec>(schema.map((spec) => [spec.name, spec]))

  for (const property of properties) {
    if (result.has(property.key.name)) {
      errors.push(new CompileError(`Duplicate property named "${property.key.name}"`, property.key.range))
      continue
    }

    const spec = schemaAsMap.get(property.key.name)
    if (spec == null) {
      errors.push(new CompileError(`Unknown property "${property.key.name}"`, property.key.range))
      continue
    }

    const expressionCheck = checkExpression(context, property.value)
    errors.push(...expressionCheck.errors)

    if (expressionCheck.result != null) {
      errors.push(...checkType([spec.type], expressionCheck.result, property.value.range))
      result.set(property.key.name, expressionCheck.result)
    }
  }

  for (const spec of schema) {
    if (spec.required && !result.has(spec.name)) {
      errors.push(new CompileError(`Missing required property "${spec.name}"`, parentRange))
    }
  }

  return { errors, result: errors.length > 0 ? undefined : result }
}

function checkArguments (context: Context, args: ReadonlyArray<ast.Expression | ast.Property>, schema: PropertySchema, parentRange?: SourceRange): Checked<ReadonlyMap<string, Type>> {
  const errors: CompileError[] = []

  const result = new Map<string, Type>()

  // Remember which argument had errors in their expression check. Otherwise,
  // in addition to reporting the expression's error, we would also report the argument as missing,
  // which is not correct.
  const errorArguments = new Set<string>()

  const schemaAsMap = new Map<string, PropertySpec>(schema.map((spec) => [spec.name, spec]))

  const checkArgumentValue = (spec: PropertySpec, value: ast.Expression): void => {
    const expressionCheck = checkExpression(context, value)
    errors.push(...expressionCheck.errors)

    if (expressionCheck.result == null) {
      errorArguments.add(spec.name)
      return
    }

    errors.push(...checkType([spec.type], expressionCheck.result, value.range))
    result.set(spec.name, expressionCheck.result)
  }

  let index = 0

  // Positional arguments
  for (; index < args.length; ++index) {
    const arg = args[index]
    if (arg.type === 'Property') {
      break
    }

    const spec = schema.at(index)
    if (spec == null) {
      errors.push(new CompileError(`Unknown positional argument`, arg.range))
      continue
    }

    checkArgumentValue(spec, arg)
  }

  // Named arguments
  for (; index < args.length; ++index) {
    const arg = args[index]
    if (arg.type !== 'Property') {
      errors.push(new CompileError(`Unexpected positional argument after named arguments`, arg.range))
      continue
    }

    const spec = schemaAsMap.get(arg.key.name)
    if (spec == null) {
      errors.push(new CompileError(`Unknown argument "${arg.key.name}"`, arg.key.range))
      continue
    }

    if (result.has(arg.key.name)) {
      errors.push(new CompileError(`Duplicate argument named "${arg.key.name}"`, arg.key.range))
      continue
    }

    checkArgumentValue(spec, arg.value)
  }

  for (const spec of schema) {
    if (spec.required && !result.has(spec.name) && !errorArguments.has(spec.name)) {
      errors.push(new CompileError(`Missing required argument "${spec.name}"`, parentRange))
    }
  }

  return { errors, result: errors.length > 0 ? undefined : result }
}
