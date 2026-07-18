import type { StepValue } from '@meyfa/cadence-core'
import type { SourceRange } from './range.ts'

export interface ASTNode {
  readonly type: string
  readonly range: SourceRange
}

// Basic Types

export interface Identifier extends ASTNode {
  readonly type: 'Identifier'
  readonly name: string
}

export interface Number extends ASTNode {
  readonly type: 'Number'
  readonly value: number
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

export interface CurveSegment extends ASTNode {
  readonly type: 'CurveSegment'
  readonly curveType: string
  readonly parameters: readonly Expression[]
  readonly length: Expression
}

export interface Curve extends ASTNode {
  readonly type: 'Curve'
  readonly children: ReadonlyArray<CurveSegment | Expression>
}

// Imports

export interface Import extends ASTNode {
  readonly type: 'Import'
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

export type Value = Identifier | Number | String | Pattern | Curve | Instrument | Voice | Mixer | Bus | Track | Part | Routing | Automation
export type Expression = Value | UnaryExpression | BinaryExpression | PropertyAccess | Call

// Composite Types

export type ArgumentList = ReadonlyArray<Expression | Property>

export interface Property extends ASTNode {
  readonly type: 'Property'
  readonly key: Identifier
  readonly value: Expression
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

// Domain Types

export interface Mixer extends ASTNode {
  readonly type: 'Mixer'
  readonly properties: ArgumentList
  readonly children: readonly Statement[]
}

export interface Bus extends ASTNode {
  readonly type: 'Bus'
  readonly name?: Identifier
  readonly properties: ArgumentList
  readonly children: ReadonlyArray<Statement | EffectStatement>
}

export interface EffectStatement extends ASTNode {
  readonly type: 'EffectStatement'
  readonly name?: Identifier
  readonly expression: Expression
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

// Root Type

export interface Program extends ASTNode {
  readonly type: 'Program'
  readonly imports: readonly Import[]
  readonly children: readonly Statement[]
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

  CurveSegment: CurveSegment
  Curve: Curve

  Import: Import

  UnaryExpression: UnaryExpression
  BinaryExpression: BinaryExpression
  PropertyAccess: PropertyAccess
  Call: Call

  Property: Property
  Statement: Statement

  Mixer: Mixer
  Bus: Bus
  EffectStatement: EffectStatement
  Track: Track
  Part: Part
  Routing: Routing
  Automation: Automation

  Instrument: Instrument
  Voice: Voice

  Program: Program
}

export type AnyNode = NodeByType[keyof NodeByType]
