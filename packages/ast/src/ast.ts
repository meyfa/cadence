import type { StepValue } from '@meyfa/cadence-core'
import type { SourceRange } from './range.ts'

// Abstract Type

export interface ASTNode {
  readonly type: string
  readonly range: SourceRange
}

// Factory

export function make<T extends keyof NodeByType> (
  type: T,
  range: SourceRange,
  props: Omit<NodeByType[T], 'type' | 'range'>
): NodeByType[T] {
  return {
    ...(props as any),

    // must come last to override props
    type,
    range
  } as NodeByType[T]
}

export interface NodeByType {
  // Root Type
  Program: Program

  // Building Blocks
  Import: Import
  Statement: Statement
  Identifier: Identifier

  // Expressions
  UnaryExpression: UnaryExpression
  BinaryExpression: BinaryExpression
  PropertyAccess: PropertyAccess
  Call: Call
  Property: Property

  // Primitive Types
  Number: Number
  String: String
  Pattern: Pattern
  Step: Step
  Curve: Curve
  CurveSegment: CurveSegment

  // Constructed Types
  Mixer: Mixer
  Bus: Bus
  Track: Track
  Part: Part
  Instrument: Instrument
  Voice: Voice

  // Combination Types
  Routing: Routing
  Automation: Automation
}

export type AnyNode = NodeByType[keyof NodeByType]

export type Value =
  Identifier |
  Number |
  String |
  Pattern |
  Curve |
  Mixer |
  Bus |
  Track |
  Part |
  Instrument |
  Voice |
  Routing |
  Automation

export type Expression =
  Value |
  UnaryExpression |
  BinaryExpression |
  PropertyAccess |
  Call

// Root Type

export interface Program extends ASTNode {
  readonly type: 'Program'
  readonly imports: readonly Import[]
  readonly children: readonly Statement[]
}

// Building Blocks

export interface Import extends ASTNode {
  readonly type: 'Import'
  readonly library: String

  /**
   * The alias to use for the imported library. If undefined, imports all symbols directly.
   */
  readonly alias?: string
}

export type Statement = NamedStatement | UnnamedStatement

interface NamedStatement extends ASTNode {
  readonly type: 'Statement'
  readonly emit: boolean
  readonly expose: boolean
  readonly name: Identifier
  readonly values: readonly [Expression]
}

interface UnnamedStatement extends ASTNode {
  readonly type: 'Statement'
  readonly emit: true
  readonly expose: false
  readonly name?: undefined
  readonly values: readonly [Expression, ...Expression[]]
}

export interface Identifier extends ASTNode {
  readonly type: 'Identifier'
  readonly name: string
}

// Expressions

export const unaryOperators = ['+', '-'] as const
export type UnaryOperator = typeof unaryOperators[number]

export const binaryOperators = ['+', '-', '*', '/'] as const
export type BinaryOperator = typeof binaryOperators[number]

export interface UnaryExpression extends ASTNode {
  readonly type: 'UnaryExpression'
  readonly operator: UnaryOperator
  readonly argument: Expression
}

export interface BinaryExpression extends ASTNode {
  readonly type: 'BinaryExpression'
  readonly operator: BinaryOperator
  readonly left: Expression
  readonly right: Expression
}

export interface PropertyAccess extends ASTNode {
  readonly type: 'PropertyAccess'
  readonly object: Expression
  readonly property: Identifier
}

export interface Call extends ASTNode {
  readonly type: 'Call'
  readonly callee: Expression
  readonly arguments: ArgumentList
}

export type ArgumentList = ReadonlyArray<Expression | Property>

export interface Property extends ASTNode {
  readonly type: 'Property'
  readonly key: Identifier
  readonly value: Expression
}

// Primitive Types

export interface Number extends ASTNode {
  readonly type: 'Number'
  readonly value: number
}

export interface String extends ASTNode {
  readonly type: 'String'
  readonly parts: ReadonlyArray<string | Expression>
}

export interface Pattern extends ASTNode {
  readonly type: 'Pattern'
  readonly mode: 'serial' | 'parallel'
  readonly children: ReadonlyArray<Step | Expression>
}

export interface Step extends ASTNode {
  readonly type: 'Step'
  readonly value: StepValue
  readonly length?: Expression
  readonly parameters: ArgumentList
}

export interface Curve extends ASTNode {
  readonly type: 'Curve'
  readonly children: ReadonlyArray<CurveSegment | Expression>
}

export interface CurveSegment extends ASTNode {
  readonly type: 'CurveSegment'
  readonly curveType: string
  readonly parameters: readonly Expression[]
  readonly length: Expression
}

// Constructed Types

export interface Mixer extends ASTNode {
  readonly type: 'Mixer'
  readonly properties: ArgumentList
  readonly children: readonly Statement[]
}

export interface Bus extends ASTNode {
  readonly type: 'Bus'
  readonly name?: Identifier
  readonly properties: ArgumentList
  readonly children: readonly Statement[]
}

export interface Track extends ASTNode {
  readonly type: 'Track'
  readonly properties: ArgumentList
  readonly children: readonly Statement[]
}

export interface Part extends ASTNode {
  readonly type: 'Part'
  readonly name?: Identifier
  readonly properties: ArgumentList
  readonly children: readonly Statement[]
}

export interface Instrument extends ASTNode {
  readonly type: 'Instrument'
  readonly children: readonly Statement[]
}

export interface Voice extends ASTNode {
  readonly type: 'Voice'
  readonly children: readonly Statement[]
  readonly bindings: {
    readonly note?: Identifier
  }
}

// Combination Types

export interface Routing extends ASTNode {
  readonly type: 'Routing'
  readonly destination: Identifier
  readonly source: Expression
}

export interface Automation extends ASTNode {
  readonly type: 'Automation'
  readonly target: Expression
  readonly curve: Expression
}
