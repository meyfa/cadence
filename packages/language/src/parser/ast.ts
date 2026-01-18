import type { StepValue } from '@core/program.js'
import type { SourceRange } from '../range.js'

export interface ASTNode {
  readonly type: string
  readonly range: SourceRange
}

// Basic Types

export const units = ['bpm', 'bars', 'beats', 's', 'ms', 'hz', 'db'] as const
export type Unit = typeof units[number]

export interface Identifier extends ASTNode {
  readonly type: 'Identifier'
  readonly name: string
}

export interface Number extends ASTNode {
  readonly type: 'Number'
  readonly value: number
  readonly unit?: Unit
}

export interface String extends ASTNode {
  readonly type: 'String'
  readonly parts: ReadonlyArray<string | Expression>
}

export interface Step extends ASTNode {
  readonly type: 'Step'
  readonly value: StepValue
  readonly length?: Expression
  readonly parameters: ArgumentList
}

type PatternMode = 'serial' | 'parallel'

export interface Pattern extends ASTNode {
  readonly type: 'Pattern'
  readonly mode: PatternMode
  readonly children: ReadonlyArray<Step | Expression>
}

// Imports

export interface UseStatement extends ASTNode {
  readonly type: 'UseStatement'
  readonly library: String

  /**
   * The alias to use for the imported library. If undefined, imports all symbols directly.
   */
  readonly alias?: string
}

// Expression Types

export const unaryOperators = ['+', '-'] as const
export type UnaryOperator = typeof unaryOperators[number]

export interface UnaryExpression extends ASTNode {
  readonly type: 'UnaryExpression'
  readonly operator: UnaryOperator
  readonly argument: Expression
}

export const binaryOperators = ['+', '-', '*', '/'] as const
export type BinaryOperator = typeof binaryOperators[number]

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
  readonly arguments: ReadonlyArray<Expression | Property>
}

export type Value = Number | String | Pattern | Identifier
export type Expression = Value | UnaryExpression | BinaryExpression | PropertyAccess | Call

// Composite Types

export interface Property extends ASTNode {
  readonly type: 'Property'
  readonly key: Identifier
  readonly value: Expression
}

export interface Assignment extends ASTNode {
  readonly type: 'Assignment'
  readonly key: Identifier
  readonly value: Expression
}

export interface Routing extends ASTNode {
  readonly type: 'Routing'
  readonly destination: Identifier
  readonly source: Expression
}

export type ArgumentList = ReadonlyArray<Expression | Property>

// Domain Types

export interface TrackStatement extends ASTNode {
  readonly type: 'TrackStatement'
  readonly properties: ArgumentList
  readonly sections: readonly SectionStatement[]
}

export interface SectionStatement extends ASTNode {
  readonly type: 'SectionStatement'
  readonly name: Identifier
  readonly properties: ArgumentList
  readonly routings: readonly Routing[]
}

export interface MixerStatement extends ASTNode {
  readonly type: 'MixerStatement'
  readonly properties: ArgumentList
  readonly buses: readonly BusStatement[]
}

export interface BusStatement extends ASTNode {
  readonly type: 'BusStatement'
  readonly name: Identifier
  readonly properties: ArgumentList
  readonly sources: readonly Identifier[]
  readonly effects: readonly EffectStatement[]
}

export interface EffectStatement extends ASTNode {
  readonly type: 'EffectStatement'
  readonly expression: Expression
}

// Root Type

export interface Program extends ASTNode {
  readonly type: 'Program'
  readonly imports: readonly UseStatement[]
  readonly children: ReadonlyArray<Assignment | TrackStatement | MixerStatement>
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
  Identifier: Identifier

  Number: Number
  String: String
  Step: Step
  Pattern: Pattern

  UseStatement: UseStatement

  UnaryExpression: UnaryExpression
  BinaryExpression: BinaryExpression
  PropertyAccess: PropertyAccess

  Property: Property
  Call: Call
  Assignment: Assignment
  Routing: Routing

  TrackStatement: TrackStatement
  SectionStatement: SectionStatement
  MixerStatement: MixerStatement
  BusStatement: BusStatement
  EffectStatement: EffectStatement

  Program: Program
}

export type AnyNode = NodeByType[keyof NodeByType]
