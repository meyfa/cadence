import type { ast } from '@meyfa/cadence-ast'
import { setAll } from '@meyfa/cadence-utility'
import type { Capabilities } from '../../type-system/base/function.ts'
import { RecordFacet } from '../../type-system/base/record.ts'
import { makeType } from '../../type-system/factory.ts'
import type { Schema } from '../../type-system/schema.ts'
import { makeSchema } from '../../type-system/schema.ts'
import type { Facet, FacetType } from '../../type-system/types.ts'
import { CompileError } from '../error.ts'
import { checkArguments } from './arguments.ts'
import { mergeCapabilities, noCapabilities } from './capabilities.ts'
import type { MutableEmissions, Slots } from './emissions.ts'
import { addEmission, validateEmissions } from './emissions.ts'
import type { Binding, Scope } from './scopes.ts'
import { createLocalScope } from './scopes.ts'
import { checkStatement } from './statements.ts'

export interface BlockNode extends ast.ASTNode {
  readonly arguments?: readonly ast.Argument[]
  readonly children: readonly ast.Statement[]
}

export interface BlockSchema<TBlock extends BlockNode> {
  /**
   * The primary facet that identifies the type of this block.
   */
  readonly facet: Facet

  /**
   * The capabilities that are required to construct a value of this type (if any).
   * If the block is used in a context that does not allow these capabilities, an error will be reported.
   */
  readonly ownCapabilities?: Capabilities

  /**
   * The capabilities that are allowed for statements within this block.
   * If not specified, the capabilities of the parent scope will be used.
   */
  readonly allowedCapabilities?: Capabilities

  /**
   * The schema for the parameters that this block accepts (if any).
   */
  readonly parameters?: Schema

  /**
   * The emissions that are allowed and expected within this block (if any). If not specified or empty, no emissions are allowed.
   * Required types must be emitted _at least_ once; singular types may be emitted _at most_ once.
   */
  readonly slots?: Slots

  /**
   * The properties that are allowed to be exposed by statements within this block (if any).
   * If not specified, no properties are allowed to be exposed.
   */
  readonly properties?: PropertyOptions

  /**
   * Compute the bindings that are available inside this block, if any. These may not be overridden by statements within the block.
   */
  readonly getBindings?: (block: TBlock) => ReadonlyMap<string, Binding>
}

export type PropertyOptions =
  {
    readonly allow: false
  } |
  {
    readonly allow: true

    /**
     * Properties that are intrinsic to this block and are always present.
     * Statements within the block may not override these properties.
     */
    readonly initial?: ReadonlyMap<string, Binding>
  }

export type BlockChecker<TBlock extends BlockNode> = (scope: Scope, block: TBlock) => CheckedBlock

export interface CheckedBlock {
  readonly errors: readonly CompileError[]
  readonly capabilities: Capabilities
  readonly result?: FacetType
}

export function createBlockChecker<TBlock extends BlockNode> (schema: BlockSchema<TBlock>): BlockChecker<TBlock> {
  const typeName = schema.facet.format()
  const ownCapabilities = schema.ownCapabilities ?? noCapabilities
  const parameters = schema.parameters ?? emptySchema
  const slots = schema.slots ?? []

  const initialProperties = schema.properties?.allow === true && schema.properties.initial != null
    ? schema.properties.initial
    : undefined

  return (scope: Scope, block: TBlock): CheckedBlock => {
    const errors: CompileError[] = []
    let capabilities = ownCapabilities

    if (capabilities.mayBlock && !scope.allowedCapabilities.mayBlock) {
      errors.push(new CompileError(`Constructing a value of type ${typeName} may block, but blocking is not allowed in this context`, block.range))
    }

    const argumentCheck = checkArguments(scope, block.arguments ?? [], parameters, block.range)
    errors.push(...argumentCheck.errors)
    capabilities = mergeCapabilities(capabilities, argumentCheck.capabilities)

    const blockScope = createLocalScope(scope, schema.allowedCapabilities)

    if (schema.getBindings != null) {
      setAll(blockScope.resolutions, schema.getBindings(block))
    }

    const emissions: MutableEmissions = new Map()
    const properties = new Map<string, Binding>(initialProperties)

    for (const child of block.children) {
      const statement = checkStatement(blockScope, child, {
        context: typeName,
        slots,
        existingProperties: properties
      })
      errors.push(...statement.errors)
      capabilities = mergeCapabilities(capabilities, statement.capabilities)

      for (const emission of statement.emissions.values()) {
        errors.push(...addEmission(emissions, emission))
      }

      if (schema.properties?.allow === true) {
        setAll(properties, statement.properties)
      } else if (statement.properties.size > 0) {
        errors.push(new CompileError(`Cannot expose properties in this context (${typeName})`, child.range))
      }
    }

    errors.push(...validateEmissions(emissions, slots, block.range))

    const result = makeBlockType(schema.facet, properties)

    return { errors, capabilities, result }
  }
}

const emptySchema = makeSchema([])

function makeBlockType (facet: Facet, properties: ReadonlyMap<string, Binding>): FacetType {
  const fields: Record<string, FacetType> = Object.create(null)
  let hasDefiniteProperties = false

  for (const [name, binding] of properties) {
    if (!binding.definite) {
      continue
    }

    fields[name] = binding.type
    hasDefiniteProperties = true
  }

  if (facet === RecordFacet) {
    return RecordFacet.with(fields).type()
  }

  if (!hasDefiniteProperties) {
    return facet.type()
  }

  return makeType(facet, RecordFacet.with(fields))
}
