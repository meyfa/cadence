import type { Location } from './location.js'

export interface ASTNode {
  readonly type: string
  readonly location: Location
}

// Basic Types

export const units = ['bpm', 'bars', 'beats', 's', 'ms', 'hz', 'db'] as const
export type Unit = typeof units[number]

export interface Identifier extends ASTNode {
  readonly type: 'Identifier'
  readonly name: string
}

export interface NumberLiteral extends ASTNode {
  readonly type: 'NumberLiteral'
  readonly value: number
  readonly unit?: Unit
}

export interface StringLiteral extends ASTNode {
  readonly type: 'StringLiteral'
  readonly value: string
}

export type Step = 'rest' | 'hit'

export interface PatternLiteral extends ASTNode {
  readonly type: 'PatternLiteral'
  readonly value: readonly Step[]
}

export type Literal = NumberLiteral | StringLiteral | PatternLiteral

export type Value = Literal | Call | Identifier

export const binaryOperators = ['+'] as const
export type BinaryOperator = typeof binaryOperators[number]

export interface BinaryExpression extends ASTNode {
  readonly type: 'BinaryExpression'
  readonly operator: BinaryOperator
  readonly left: Expression
  readonly right: Expression
}

export type Expression = Value | BinaryExpression

// Composite Types

export interface Property extends ASTNode {
  readonly type: 'Property'
  readonly key: Identifier
  readonly value: Expression
}

export interface Call extends ASTNode {
  readonly type: 'Call'
  readonly callee: Identifier
  readonly arguments: readonly Property[]
}

export interface Assignment extends ASTNode {
  readonly type: 'Assignment'
  readonly key: Identifier
  readonly value: Expression
}

export interface Routing extends ASTNode {
  readonly type: 'Routing'
  readonly instrument: Identifier
  readonly pattern: PatternLiteral | Identifier
}

// Domain Types

export interface TrackStatement extends ASTNode {
  readonly type: 'TrackStatement'
  readonly properties: readonly Property[]
  readonly sections: readonly SectionStatement[]
}

export interface SectionStatement extends ASTNode {
  readonly type: 'SectionStatement'
  readonly name: Identifier
  readonly length: NumberLiteral
  readonly routings: readonly Routing[]
}

// Root Type

export interface Program extends ASTNode {
  readonly type: 'Program'
  readonly track?: TrackStatement
  readonly assignments: readonly Assignment[]
}
