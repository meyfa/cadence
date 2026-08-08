import type { ast, SourceRange } from '@meyfa/cadence-ast'
import { setAll } from '@meyfa/cadence-utility'
import type { Capabilities } from '../../type-system/base/function.ts'
import { RecordFacet } from '../../type-system/base/record.ts'
import { makeType } from '../../type-system/factory.ts'
import type { Schema } from '../../type-system/schema.ts'
import { makeSchema } from '../../type-system/schema.ts'
import type { Facet, FacetType, Type } from '../../type-system/types.ts'
import { CompileError } from '../error.ts'
import { checkArguments } from './arguments.ts'
import { mergeCapabilities, noCapabilities } from './capabilities.ts'
import type { Scope } from './scopes.ts'
import { createLocalScope } from './scopes.ts'
import type { Emission } from './statements.ts'
import { checkStatement } from './statements.ts'

export interface BlockNode extends ast.ASTNode {
  readonly arguments?: readonly ast.Argument[]
  readonly children: readonly ast.Statement[]
  readonly name?: ast.Identifier
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
  readonly slots?: readonly Slot[]

  /**
   * The properties that are allowed to be exposed by statements within this block (if any).
   * If not specified, no properties are allowed to be exposed.
   */
  readonly properties?: PropertyOptions

  /**
   * The namespace to which this block belongs (if any). This will take effect for blocks with a name field.
   */
  readonly namespace?: string

  /**
   * Compute the bindings that are available inside this block, if any. These may not be overridden by statements within the block.
   */
  readonly getBindings?: (block: TBlock) => ReadonlyMap<string, FacetType>
}

export interface Slot {
  readonly name: string
  readonly type: Type
  readonly required?: boolean
  readonly singular?: boolean
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
    readonly initial?: ReadonlyMap<string, FacetType>
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

    const emissionCollector = new EmissionCollector(typeName, schema.slots ?? [])
    const properties = new Map<string, FacetType>(initialProperties)

    for (const child of block.children) {
      const statement = checkStatement(blockScope, child, properties)
      errors.push(...statement.errors)
      capabilities = mergeCapabilities(capabilities, statement.capabilities)

      for (const emission of statement.emissions) {
        errors.push(...emissionCollector.add(emission))
      }

      if (schema.properties?.allow === true) {
        setAll(properties, statement.properties)
      } else if (statement.properties.size > 0) {
        errors.push(new CompileError(`Cannot expose properties in this context (${typeName})`, child.range))
      }
    }

    errors.push(...emissionCollector.validate(block.range))

    const result = makeBlockType(schema.facet, properties)

    if (schema.namespace != null) {
      errors.push(...checkBlockName(scope, schema.namespace, block, result))
    }

    return { errors, capabilities, result }
  }
}

// Private implementation

const emptySchema = makeSchema([])

class EmissionCollector {
  private readonly typeName: string
  private readonly slots: readonly Slot[]
  private readonly emissions: Emission[][]

  constructor (typeName: string, slots: readonly Slot[]) {
    this.typeName = typeName
    this.slots = slots
    this.emissions = slots.map(() => [])
  }

  public add (emission: Emission): readonly CompileError[] {
    const errors: CompileError[] = []

    if (this.slots.length === 0) {
      errors.push(new CompileError(`Cannot emit values in this context (${this.typeName})`, emission.range))
      return errors
    }

    const slotIndex = this.slots.findIndex(({ type }) => type.is(emission.type))
    if (slotIndex === -1) {
      const expectedTypes = this.slots.map((slot) => slot.type.format()).join(', ')
      errors.push(new CompileError(`Unexpected emitted value of type ${emission.type.format()}; expected one of: ${expectedTypes}`, emission.range))
      return errors
    }

    this.emissions[slotIndex].push(emission)

    return errors
  }

  public validate (range: SourceRange): readonly CompileError[] {
    const errors: CompileError[] = []

    for (const [index, slot] of this.slots.entries()) {
      const emitted = this.emissions[index]

      if (slot.required && emitted.length === 0) {
        errors.push(new CompileError(`Expected at least one emission into slot "${slot.name}" of type ${slot.type.format()}`, range))
        continue
      }

      if (slot.singular) {
        for (let j = 1; j < emitted.length; ++j) {
          errors.push(new CompileError(`Duplicate emission into slot "${slot.name}" of type ${slot.type.format()} which accepts at most one value`, emitted[j].range))
        }
      }
    }

    return errors
  }
}

function checkBlockName (scope: Scope, namespace: string, block: BlockNode, type: FacetType): readonly CompileError[] {
  const errors: CompileError[] = []
  if (block.name == null) {
    return errors
  }

  const namespaceObject = scope.top.namespaces.get(namespace)
  if (namespaceObject == null) {
    errors.push(new CompileError(`Namespace "${namespace}" is not defined`, block.range))
    return errors
  }

  const duplicate = namespaceObject.resolutions.has(block.name.name)
  if (duplicate) {
    errors.push(new CompileError(`Duplicate definition of "${block.name.name}" in namespace "${namespace}"`, block.name.range))
    return errors
  }

  namespaceObject.resolutions.set(block.name.name, type)

  return errors
}

function makeBlockType (facet: Facet, properties: ReadonlyMap<string, FacetType>): FacetType {
  if (facet === RecordFacet) {
    return RecordFacet.with(Object.fromEntries(properties)).type()
  }

  if (properties.size === 0) {
    return facet.type()
  }

  return makeType(facet, RecordFacet.with(Object.fromEntries(properties)))
}
