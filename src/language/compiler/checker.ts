import { CompileError } from './error.js'
import * as ast from '../parser/ast.js'
import { areTypesEqual, formatType, typeOf, type TypeInfo } from './values.js'
import { getDefaultFunctions } from './functions.js'
import type { SourceLocation } from '../location.js'
import { toBaseUnit } from './units.js'
import type { PropertySchema, PropertySpec } from './schema.js'
import { busSchema, mixerSchema, sectionSchema, trackSchema } from './common.js'

interface Context {
  // Intentionally mutable to allow building up during checking
  readonly resolutions: Map<string, TypeInfo>
}

interface Checked<TValue> {
  readonly errors: readonly CompileError[]
  readonly result?: TValue
}

export function check (program: ast.Program): readonly CompileError[] {
  const context: Context = {
    resolutions: new Map([...getDefaultFunctions()].map(([name, fn]) => [name, typeOf(fn)]))
  }

  const assignments = program.children.filter((c) => c.type === 'Assignment')
  const tracks = program.children.filter((c) => c.type === 'TrackStatement')
  const mixers = program.children.filter((c) => c.type === 'MixerStatement')

  return [
    ...checkAssignments(context, assignments),
    ...checkTracks(context, tracks),
    ...checkMixers(context, mixers)
  ]
}

function checkTypeEquality (expected: TypeInfo, actual: TypeInfo, location?: SourceLocation): readonly CompileError[] {
  if (!areTypesEqual(expected, actual)) {
    return [new CompileError(`Expected type ${formatType(expected)}, got ${formatType(actual)}`, location)]
  }

  return []
}

function checkAssignments (context: Context, assignments: readonly ast.Assignment[]): readonly CompileError[] {
  const errors: CompileError[] = []

  for (const assignment of assignments) {
    const duplicate = context.resolutions.has(assignment.key.name)
    if (duplicate) {
      errors.push(new CompileError(`Identifier "${assignment.key.name}" is already defined`, assignment.key.location))
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
      errors.push(new CompileError('Multiple track definitions', track.location))
    }

    errors.push(...checkTrack(context, track))
  }

  return errors
}

function checkTrack (context: Context, track: ast.TrackStatement): readonly CompileError[] {
  const errors: CompileError[] = []

  const propertiesCheck = checkProperties(context, track.properties, trackSchema, track.location)
  errors.push(...propertiesCheck.errors)

  const seenSections = new Set<string>()

  for (const section of track.sections) {
    if (seenSections.has(section.name.name)) {
      errors.push(new CompileError(`Duplicate section named "${section.name.name}"`, section.location))
    }
    if (context.resolutions.has(section.name.name)) {
      errors.push(new CompileError(`Section name "${section.name.name}" conflicts with existing identifier`, section.name.location))
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
    errors.push(...checkTypeEquality({ type: 'Number', unit: 'steps' }, lengthCheck.result, section.length.location))
  }

  const propertiesCheck = checkProperties(context, section.properties, sectionSchema, section.location)
  errors.push(...propertiesCheck.errors)

  const seenRoutings = new Set<string>()

  for (const routing of section.routings) {
    if (seenRoutings.has(routing.instrument.name)) {
      errors.push(new CompileError(`Duplicate routing for instrument "${routing.instrument.name}"`, routing.location))
    }
    seenRoutings.add(routing.instrument.name)
    errors.push(...checkRouting(context, routing))
  }

  return errors
}

function checkMixers (context: Context, mixers: readonly ast.MixerStatement[]): readonly CompileError[] {
  const errors: CompileError[] = []

  for (const mixer of mixers) {
    if (mixers.length > 1) {
      errors.push(new CompileError('Multiple mixer definitions', mixer.location))
    }
    errors.push(...checkMixer(context, mixer))
  }

  return errors
}

function checkMixer (context: Context, mixer: ast.MixerStatement): readonly CompileError[] {
  const errors: CompileError[] = []

  const propertiesCheck = checkProperties(context, mixer.properties, mixerSchema, mixer.location)
  errors.push(...propertiesCheck.errors)

  for (const routing of mixer.routings) {
    errors.push(...checkRouting(context, routing))
  }

  const seenBuses = new Set<string>()

  for (const bus of mixer.buses) {
    if (seenBuses.has(bus.name.name)) {
      errors.push(new CompileError(`Duplicate bus named "${bus.name.name}"`, bus.location))
    }
    if (context.resolutions.has(bus.name.name)) {
      errors.push(new CompileError(`Bus name "${bus.name.name}" conflicts with existing identifier`, bus.name.location))
    }
    seenBuses.add(bus.name.name)
    errors.push(...checkBus(context, bus))
  }

  return errors
}

function checkBus (context: Context, bus: ast.BusStatement): readonly CompileError[] {
  const errors: CompileError[] = []

  const propertiesCheck = checkProperties(context, bus.properties, busSchema, bus.location)
  errors.push(...propertiesCheck.errors)

  return errors
}

function checkRouting (context: Context, routing: ast.Routing): readonly CompileError[] {
  const errors: CompileError[] = []

  const instrument = context.resolutions.get(routing.instrument.name)
  if (instrument == null) {
    errors.push(new CompileError(`Unknown identifier "${routing.instrument.name}"`, routing.instrument.location))
  } else {
    errors.push(...checkTypeEquality({ type: 'Instrument' }, instrument, routing.instrument.location))
  }

  const patternCheck = checkExpression(context, routing.pattern)
  errors.push(...patternCheck.errors)
  if (patternCheck.result != null) {
    errors.push(...checkTypeEquality({ type: 'Pattern' }, patternCheck.result, routing.pattern.location))
  }

  return errors
}

function checkExpression (context: Context, expression: ast.Expression): Checked<TypeInfo> {
  switch (expression.type) {
    case 'StringLiteral':
      return { errors: [], result: { type: 'String' } }

    case 'NumberLiteral':
      return { errors: [], result: { type: 'Number', unit: toBaseUnit(expression.unit) } }

    case 'PatternLiteral':
      return { errors: [], result: { type: 'Pattern' } }

    case 'Identifier': {
      const valueType = context.resolutions.get(expression.name)
      if (valueType == null) {
        return { errors: [new CompileError(`Unknown identifier "${expression.name}"`, expression.location)] }
      }
      return { errors: [], result: valueType }
    }

    case 'Call': {
      const callee = context.resolutions.get(expression.callee.name)
      if (callee == null) {
        return { errors: [new CompileError(`Unknown identifier "${expression.callee.name}"`, expression.location)] }
      }

      if (callee.type !== 'Function' || callee.schema == null || callee.returnType == null) {
        return { errors: [new CompileError(`"${expression.callee.name}" is not a calleetion`, expression.callee.location)] }
      }

      const { errors } = checkProperties(context, expression.arguments, callee.schema, expression.location)
      return { errors, result: callee.returnType }
    }

    case 'BinaryExpression': {
      const leftCheck = checkExpression(context, expression.left)
      const rightCheck = checkExpression(context, expression.right)

      const errors = [...leftCheck.errors, ...rightCheck.errors]

      if (leftCheck.result == null || rightCheck.result == null) {
        return { errors }
      }

      return checkBinaryExpression(expression.operator, leftCheck.result, rightCheck.result, expression.location)
    }
  }
}

function checkBinaryExpression (operator: ast.BinaryOperator, left: TypeInfo, right: TypeInfo, location: SourceLocation): Checked<TypeInfo> {
  switch (operator) {
    case '+':
      return checkPlus(left, right, location)
    case '-':
      return checkMinus(left, right, location)
    case '*':
      return checkMultiply(left, right, location)
    case '/':
      return checkDivide(left, right, location)
  }
}

function checkPlus (left: TypeInfo, right: TypeInfo, location: SourceLocation): Checked<TypeInfo> {
  if (left.type === 'String' && right.type === 'String') {
    return { errors: [], result: left }
  }

  if (left.type === 'Pattern' && right.type === 'Pattern') {
    return { errors: [], result: left }
  }

  if (left.type === 'Number' && right.type === 'Number' && left.unit === right.unit) {
    return { errors: [], result: left }
  }

  return { errors: [new CompileError(`Incompatible operands: ${formatType(left)} and ${formatType(right)}`, location)] }
}

function checkMinus (left: TypeInfo, right: TypeInfo, location: SourceLocation): Checked<TypeInfo> {
  if (left.type === 'Number' && right.type === 'Number' && left.unit === right.unit) {
    return { errors: [], result: left }
  }

  return { errors: [new CompileError(`Incompatible operands: ${formatType(left)} and ${formatType(right)}`, location)] }
}

function checkMultiply (left: TypeInfo, right: TypeInfo, location: SourceLocation): Checked<TypeInfo> {
  if (left.type === 'Number' && right.type === 'Number' && (left.unit == null || right.unit == null)) {
    return { errors: [], result: { type: 'Number', unit: left.unit ?? right.unit } }
  }

  if ((left.type === 'Pattern' && right.type === 'Number') || (left.type === 'Number' && right.type === 'Pattern')) {
    return { errors: [], result: { type: 'Pattern' } }
  }

  return { errors: [new CompileError(`Incompatible operands: ${formatType(left)} and ${formatType(right)}`, location)] }
}

function checkDivide (left: TypeInfo, right: TypeInfo, location: SourceLocation): Checked<TypeInfo> {
  if (left.type === 'Number' && right.type === 'Number') {
    if (left.unit === right.unit) {
      return { errors: [], result: { type: 'Number', unit: undefined } }
    }

    if (right.unit == null) {
      return { errors: [], result: left }
    }
  }

  if (left.type === 'Pattern' && right.type === 'Number' && right.unit == null) {
    return { errors: [], result: left }
  }

  return { errors: [new CompileError(`Incompatible operands: ${formatType(left)} and ${formatType(right)}`, location)] }
}

function checkProperties (context: Context, properties: readonly ast.Property[], schema: PropertySchema, parentLocation?: SourceLocation): Checked<ReadonlyMap<string, TypeInfo>> {
  const errors: CompileError[] = []
  const result = new Map<string, TypeInfo>()

  const schemaAsMap = new Map<string, PropertySpec>(schema.map((spec) => [spec.name, spec]))

  for (const property of properties) {
    if (result.has(property.key.name)) {
      errors.push(new CompileError(`Duplicate property named "${property.key.name}"`, property.key.location))
      continue
    }

    const spec = schemaAsMap.get(property.key.name)
    if (spec == null) {
      errors.push(new CompileError(`Unknown property "${property.key.name}"`, property.key.location))
      continue
    }

    const expressionCheck = checkExpression(context, property.value)
    errors.push(...expressionCheck.errors)

    if (expressionCheck.result != null) {
      errors.push(...checkTypeEquality(spec.type, expressionCheck.result, property.value.location))
      result.set(property.key.name, expressionCheck.result)
    }
  }

  for (const spec of schema) {
    if (spec.required && !result.has(spec.name)) {
      errors.push(new CompileError(`Missing required property "${spec.name}"`, parentLocation))
      continue
    }
  }

  return { errors, result: errors.length > 0 ? undefined : result }
}
