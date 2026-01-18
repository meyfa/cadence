import * as ast from '../parser/ast.js'
import type { SourceRange } from '../range.js'
import { busSchema, mixerSchema, partSchema, stepSchema, trackSchema } from './common.js'
import { CompileError } from './error.js'
import { getStandardModule, standardLibraryModuleNames } from './modules.js'
import type { PropertySchema, PropertySpec } from './schema.js'
import { BusType, EffectType, FunctionType, GroupType, InstrumentType, ModuleType, NumberType, PartType, PatternType, StringType, type ModuleValue, type Type } from './types.js'
import { toBaseUnit } from './units.js'

export function check (program: ast.Program): readonly CompileError[] {
  const importResult = checkImports(program.imports)
  if (importResult.result == null) {
    return importResult.errors
  }

  const top = createGlobalScope(importResult.result)

  const context = createLocalScope(top)

  const assignments = program.children.filter((c) => c.type === 'Assignment')
  const tracks = program.children.filter((c) => c.type === 'TrackStatement')
  const mixers = program.children.filter((c) => c.type === 'MixerStatement')

  const errors = [
    ...checkAssignments(context, assignments),
    ...checkTracks(context, tracks),
    ...checkMixers(context, mixers)
  ]

  return errors
}

interface Context {
  readonly parent?: Context
  readonly resolutions: ReadonlyMap<string, Type>
}

interface MutableContext extends Context {
  readonly resolutions: Map<string, Type>
}

interface Checked<TValue> {
  readonly errors: readonly CompileError[]
  readonly result?: TValue
}

function createGlobalScope (initialResolutions: ReadonlyMap<string, Type>): Context {
  return {
    resolutions: initialResolutions
  }
}

function createLocalScope (parent: Context): MutableContext {
  return {
    parent,
    resolutions: new Map()
  }
}

function ensureStandardModule (moduleName: string): ModuleValue {
  const module = getStandardModule(moduleName)
  if (module == null) {
    throw new Error(`Missing standard library module: ${moduleName}`)
  }

  return module
}

function resolve (context: Context, name: string): Type | undefined {
  let current: Context | undefined = context

  while (current != null) {
    const valueType = current.resolutions.get(name)
    if (valueType != null) {
      return valueType
    }
    current = current.parent
  }

  return undefined
}

function checkType (options: readonly Type[], actual: Type, range?: SourceRange): readonly CompileError[] {
  if (!options.some((option) => option.equals(actual))) {
    const optionsText = options.map((o) => o.format()).join(' or ')
    return [new CompileError(`Expected type ${optionsText}, got ${actual.format()}`, range)]
  }

  return []
}

function checkImports (imports: readonly ast.UseStatement[]): Checked<ReadonlyMap<string, Type>> {
  const errors: CompileError[] = []

  const defaults = new Set<string>()
  const aliases = new Map<string, string>()

  for (const statement of imports) {
    if (!statement.library.parts.every((part) => typeof part === 'string')) {
      errors.push(new CompileError(`Imports cannot use string interpolation`, statement.library.range))
      continue
    }

    const libraryName = statement.library.parts.join('')

    if (!standardLibraryModuleNames.has(libraryName)) {
      errors.push(new CompileError(`Unknown module "${libraryName}"`, statement.range))
      continue
    }

    if (statement.alias == null) {
      if (defaults.has(libraryName)) {
        errors.push(new CompileError(`Duplicate import of "${libraryName}"`, statement.range))
      }

      defaults.add(libraryName)
      continue
    }

    if (aliases.has(statement.alias)) {
      errors.push(new CompileError(`Duplicate import alias "${statement.alias}"`, statement.range))
      continue
    }

    aliases.set(statement.alias, libraryName)
  }

  if (errors.length > 0) {
    return { errors }
  }

  const result = new Map<string, Type>()

  // defaults must come before aliases to allow aliasing over default imports
  for (const importName of defaults) {
    const module = ensureStandardModule(importName)
    for (const [name, value] of module.data.exports.entries()) {
      result.set(name, value.type)
    }
  }

  for (const [alias, importName] of aliases) {
    const module = ensureStandardModule(importName)
    result.set(alias, module.type)
  }

  return { errors, result }
}

function checkAssignments (context: MutableContext, assignments: readonly ast.Assignment[]): readonly CompileError[] {
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

function checkTracks (context: MutableContext, tracks: readonly ast.TrackStatement[]): readonly CompileError[] {
  const errors: CompileError[] = []

  for (const track of tracks) {
    if (tracks.length > 1) {
      errors.push(new CompileError('Multiple track definitions', track.range))
    }

    errors.push(...checkTrack(context, track))
  }

  return errors
}

function checkTrack (context: MutableContext, track: ast.TrackStatement): readonly CompileError[] {
  const trackContext = createLocalScope(context)

  const errors: CompileError[] = []

  const seenParts = new Set<string>()

  for (const part of track.parts) {
    if (seenParts.has(part.name.name)) {
      errors.push(new CompileError(`Duplicate part named "${part.name.name}"`, part.range))
    } else if (trackContext.resolutions.has(part.name.name)) {
      errors.push(new CompileError(`Part name "${part.name.name}" conflicts with existing identifier`, part.name.range))
    }

    seenParts.add(part.name.name)

    // Reserve the name in the local scope
    trackContext.resolutions.set(part.name.name, PartType)

    errors.push(...checkPart(trackContext, part))
  }

  const propertiesCheck = checkArgumentList(trackContext, track.properties, trackSchema, track.range, 'property')
  errors.push(...propertiesCheck.errors)

  return errors
}

function checkPart (context: Context, part: ast.PartStatement): readonly CompileError[] {
  const errors: CompileError[] = []

  const propertiesCheck = checkArgumentList(context, part.properties, partSchema, part.range, 'property')
  errors.push(...propertiesCheck.errors)

  for (const routing of part.routings) {
    errors.push(...checkInstrumentRouting(context, routing))
  }

  return errors
}

function checkInstrumentRouting (context: Context, routing: ast.Routing): readonly CompileError[] {
  const errors: CompileError[] = []

  const destination = resolve(context, routing.destination.name)
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
  const mixerContext = createLocalScope(context)

  const errors: CompileError[] = []

  const propertiesCheck = checkArgumentList(mixerContext, mixer.properties, mixerSchema, mixer.range, 'property')
  errors.push(...propertiesCheck.errors)

  const seenBuses = new Set<string>()

  // Build up the list of buses first
  for (const bus of mixer.buses) {
    if (seenBuses.has(bus.name.name)) {
      errors.push(new CompileError(`Duplicate bus named "${bus.name.name}"`, bus.range))
    } else if (mixerContext.resolutions.has(bus.name.name)) {
      errors.push(new CompileError(`Bus name "${bus.name.name}" conflicts with existing identifier`, bus.name.range))
    }

    seenBuses.add(bus.name.name)

    mixerContext.resolutions.set(bus.name.name, BusType)
  }

  // Now that all buses are known, we can check the routings
  for (const bus of mixer.buses) {
    errors.push(...checkBus(mixerContext, bus))
  }

  return errors
}

function checkBus (context: Context, bus: ast.BusStatement): readonly CompileError[] {
  const errors: CompileError[] = []

  const propertiesCheck = checkArgumentList(context, bus.properties, busSchema, bus.range, 'property')
  errors.push(...propertiesCheck.errors)

  // Sources
  for (const source of bus.sources) {
    const sourceCheck = checkExpression(context, source)
    errors.push(...sourceCheck.errors)

    if (sourceCheck.result != null) {
      const options = [InstrumentType, BusType, GroupType] as const
      errors.push(...checkType(options, sourceCheck.result, source.range))
    }
  }

  // Effects
  for (const effect of bus.effects) {
    const effectCheck = checkExpression(context, effect.expression)
    errors.push(...effectCheck.errors)

    if (effectCheck.result != null) {
      errors.push(...checkType([EffectType], effectCheck.result, effect.expression.range))
    }
  }

  return errors
}

function checkExpression (context: Context, expression: ast.Expression): Checked<Type> {
  switch (expression.type) {
    case 'Number':
      return { errors: [], result: NumberType.with(toBaseUnit(expression.unit)) }

    case 'String': {
      const errors: CompileError[] = []

      for (const part of expression.parts) {
        if (typeof part !== 'string') {
          const partCheck = checkExpression(context, part)
          if (partCheck.result == null) {
            return { errors: partCheck.errors }
          }
          errors.push(...checkType([StringType], partCheck.result, part.range))
        }
      }

      return { errors, result: StringType }
    }

    case 'Pattern': {
      const errors = checkPattern(context, expression)
      if (errors.length > 0) {
        return { errors }
      }
      return { errors: [], result: PatternType }
    }

    case 'Identifier': {
      const valueType = resolve(context, expression.name)
      if (valueType == null) {
        return { errors: [new CompileError(`Unknown identifier "${expression.name}"`, expression.range)] }
      }
      return { errors: [], result: valueType }
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

    case 'PropertyAccess': {
      const objectCheck = checkExpression(context, expression.object)
      if (objectCheck.result == null) {
        return { errors: objectCheck.errors }
      }

      return checkPropertyAccess(objectCheck.result, expression.property, expression.range)
    }

    case 'Call': {
      const calleeCheck = checkExpression(context, expression.callee)
      if (calleeCheck.result == null) {
        return { errors: calleeCheck.errors }
      }

      const callee = calleeCheck.result
      if (!FunctionType.equals(calleeCheck.result)) {
        return { errors: [new CompileError(`Cannot call value of type ${callee.format()}`, expression.range)] }
      }

      const { schema, returnType } = FunctionType.detail(callee)
      if (schema == null || returnType == null) {
        return { errors: [new CompileError(`Function is missing type information`, expression.range)] }
      }

      const { errors } = checkArgumentList(context, expression.arguments, schema, expression.range)
      return { errors, result: returnType }
    }
  }
}

function checkPattern (context: Context, pattern: ast.Pattern): readonly CompileError[] {
  const errors: CompileError[] = []

  for (const item of pattern.children) {
    if (item.type === 'Step') {
      errors.push(...checkStep(context, item))
      continue
    }

    const itemCheck = checkExpression(context, item)
    errors.push(...itemCheck.errors)

    if (itemCheck.result != null) {
      errors.push(...checkType([PatternType], itemCheck.result, item.range))
    }
  }

  return errors
}

function checkStep (context: Context, step: ast.Step): readonly CompileError[] {
  const errors: CompileError[] = []

  if (step.length != null) {
    const lengthCheck = checkExpression(context, step.length)
    if (lengthCheck.result == null) {
      errors.push(...lengthCheck.errors)
      return errors
    }

    errors.push(...checkType([NumberType.with(undefined)], lengthCheck.result, step.length.range))
  }

  const parametersCheck = checkArgumentList(context, step.parameters, stepSchema, step.range)
  errors.push(...parametersCheck.errors)

  return errors
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

function checkPropertyAccess (object: Type, property: ast.Identifier, range: SourceRange): Checked<Type> {
  if (ModuleType.equals(object)) {
    const { definition } = ModuleType.detail(object)
    if (definition == null) {
      return { errors: [new CompileError(`Module is missing type information`, property.range)] }
    }

    const propertyType = definition.exports.get(property.name)?.type
    if (propertyType != null) {
      return { errors: [], result: propertyType }
    }

    return { errors: [new CompileError(`Module "${definition.name}" has no export named "${property.name}"`, property.range)] }
  }

  return { errors: [new CompileError(`Cannot access properties of type ${object.format()}`, property.range)] }
}

function checkArgumentList (
  context: Context,
  args: ast.ArgumentList,
  schema: PropertySchema,
  parentRange: SourceRange,
  kind = 'argument'
): Checked<ReadonlyMap<string, Type>> {
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
      errors.push(new CompileError(`Unknown positional ${kind}`, arg.range))
      continue
    }

    checkArgumentValue(spec, arg)
  }

  // Named arguments
  for (; index < args.length; ++index) {
    const arg = args[index]
    if (arg.type !== 'Property') {
      errors.push(new CompileError(`Unexpected positional ${kind} after named ${kind}s`, arg.range))
      continue
    }

    const spec = schemaAsMap.get(arg.key.name)
    if (spec == null) {
      errors.push(new CompileError(`Unknown ${kind} "${arg.key.name}"`, arg.key.range))
      continue
    }

    if (result.has(arg.key.name)) {
      errors.push(new CompileError(`Duplicate ${kind} named "${arg.key.name}"`, arg.key.range))
      continue
    }

    checkArgumentValue(spec, arg.value)
  }

  for (const spec of schema) {
    if (spec.required && !result.has(spec.name) && !errorArguments.has(spec.name)) {
      errors.push(new CompileError(`Missing required ${kind} "${spec.name}"`, parentRange))
    }
  }

  return { errors, result: errors.length > 0 ? undefined : result }
}
