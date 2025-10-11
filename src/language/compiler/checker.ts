import { CompileError } from '../error.js'
import * as ast from '../ast.js'
import { areTypesEqual, formatType, type TypeInfo } from './values.js'
import { getDefaultFunctions, type FunctionDefinition } from './functions.js'
import type { Location } from '../location.js'
import { toBaseUnit } from './units.js'

interface Context {
  readonly functions: ReadonlyMap<string, FunctionDefinition>

  // Intentionally mutable to allow building up during checking
  readonly resolutions: Map<string, TypeInfo>
}

interface Checked<TValue> {
  readonly errors: readonly CompileError[]
  readonly result?: TValue
}

export function check (program: ast.Program): readonly CompileError[] {
  const context: Context = {
    functions: getDefaultFunctions(),
    resolutions: new Map()
  }

  const assignmentResults = checkAssignments(context, program)
  const trackResults = checkTracks(context, program)

  return [...assignmentResults, ...trackResults]
}

function checkTypeEquality (expected: TypeInfo, actual: TypeInfo, location: Location): readonly CompileError[] {
  if (!areTypesEqual(expected, actual)) {
    return [new CompileError(`Expected type ${formatType(expected)}, got ${formatType(actual)}`, location)]
  }

  return []
}

function checkAssignments (context: Context, program: ast.Program): readonly CompileError[] {
  const errors: CompileError[] = []

  for (const assignment of program.assignments) {
    if (context.resolutions.has(assignment.key.name)) {
      errors.push(new CompileError(`Duplicate assignment to "${assignment.key.name}"`, assignment.location))
    }

    const expressionCheck = checkExpression(context, assignment.value)
    errors.push(...expressionCheck.errors)

    if (expressionCheck.result != null) {
      context.resolutions.set(assignment.key.name, expressionCheck.result)
    }
  }

  return errors
}

function checkTracks (context: Context, program: ast.Program): readonly CompileError[] {
  const errors: CompileError[] = []

  if (program.tracks.length > 1) {
    for (const track of program.tracks) {
      errors.push(new CompileError('Multiple track definitions', track.location))
    }
  }

  for (const track of program.tracks) {
    errors.push(...checkTrack(context, track))
  }

  return errors
}

function checkTrack (context: Context, track: ast.TrackStatement): readonly CompileError[] {
  const errors: CompileError[] = []

  const propertiesCheck = checkProperties(context, track.properties)
  errors.push(...propertiesCheck.errors)

  if (propertiesCheck.result != null) {
    for (const [key, valueType] of propertiesCheck.result) {
      // TODO avoid hardcoding known properties
      if (!['tempo'].includes(key)) {
        errors.push(new CompileError(`Unknown property "${key}"`, track.location))
      }

      if (key === 'tempo') {
        errors.push(...checkTypeEquality({ type: 'Number', unit: 'bpm' }, valueType, track.location))
      }
    }
  }

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

function checkRouting (context: Context, routing: ast.Routing): readonly CompileError[] {
  const errors: CompileError[] = []

  const instrument = context.resolutions.get(routing.instrument.name)
  if (instrument == null) {
    errors.push(new CompileError(`Unresolved identifier "${routing.instrument.name}"`, routing.instrument.location))
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
        return { errors: [new CompileError(`Unresolved identifier "${expression.name}"`, expression.location)] }
      }
      return { errors: [], result: valueType }
    }

    case 'Call': {
      const func = context.functions.get(expression.callee.name)
      if (func == null) {
        return { errors: [new CompileError(`Unknown function "${expression.callee.name}"`, expression.location)] }
      }

      const errors = checkFunctionArguments(context, func.arguments, expression)
      return { errors, result: func.returnType }
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

function checkBinaryExpression (operator: ast.BinaryOperator, left: TypeInfo, right: TypeInfo, location: Location): Checked<TypeInfo> {
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

function checkPlus (left: TypeInfo, right: TypeInfo, location: Location): Checked<TypeInfo> {
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

function checkMinus (left: TypeInfo, right: TypeInfo, location: Location): Checked<TypeInfo> {
  if (left.type === 'Number' && right.type === 'Number' && left.unit === right.unit) {
    return { errors: [], result: left }
  }

  return { errors: [new CompileError(`Incompatible operands: ${formatType(left)} and ${formatType(right)}`, location)] }
}

function checkMultiply (left: TypeInfo, right: TypeInfo, location: Location): Checked<TypeInfo> {
  if (left.type === 'Number' && right.type === 'Number' && (left.unit == null || right.unit == null)) {
    return { errors: [], result: { type: 'Number', unit: left.unit ?? right.unit } }
  }

  if ((left.type === 'Pattern' && right.type === 'Number') || (left.type === 'Number' && right.type === 'Pattern')) {
    return { errors: [], result: { type: 'Pattern' } }
  }

  return { errors: [new CompileError(`Incompatible operands: ${formatType(left)} and ${formatType(right)}`, location)] }
}

function checkDivide (left: TypeInfo, right: TypeInfo, location: Location): Checked<TypeInfo> {
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

function checkProperties (context: Context, properties: readonly ast.Property[]): Checked<ReadonlyMap<string, TypeInfo>> {
  const errors: CompileError[] = []
  const result = new Map<string, TypeInfo>()

  for (const property of properties) {
    if (result.has(property.key.name)) {
      errors.push(new CompileError(`Duplicate property named "${property.key.name}"`, property.location))
      continue
    }

    const expressionCheck = checkExpression(context, property.value)
    errors.push(...expressionCheck.errors)

    if (expressionCheck.result != null) {
      result.set(property.key.name, expressionCheck.result)
    }
  }

  return { errors, result: errors.length > 0 ? undefined : result }
}

function checkFunctionArguments (context: Context, expected: ReadonlyMap<string, TypeInfo>, call: ast.Call): readonly CompileError[] {
  const args = checkProperties(context, call.arguments)
  if (args.result == null) {
    return args.errors
  }

  const errors: CompileError[] = [...args.errors]

  for (const [name, type] of expected) {
    const argType = args.result.get(name)
    if (argType == null) {
      errors.push(new CompileError(`Missing required argument "${name}"`, call.location))
      continue
    }

    errors.push(...checkTypeEquality(type, argType, call.location))
  }

  for (const name of args.result.keys()) {
    if (!expected.has(name)) {
      errors.push(new CompileError(`Unknown argument "${name}"`, call.location))
    }
  }

  return errors
}
