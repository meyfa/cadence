import type { Step } from '../../core/program.js'
import type { SourceLocation } from '../location.js'

export interface ASTNode {
  readonly type: string
  readonly location: SourceLocation
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

export interface PatternLiteral extends ASTNode {
  readonly type: 'PatternLiteral'
  readonly value: readonly Step[]
}

export type Literal = NumberLiteral | StringLiteral | PatternLiteral

export type Value = Literal | Call | Identifier

export const binaryOperators = ['+', '-', '*', '/'] as const
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
  readonly destination: Identifier
  readonly source: Expression
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
  readonly length: Expression
  readonly properties: readonly Property[]
  readonly routings: readonly Routing[]
}

export interface MixerStatement extends ASTNode {
  readonly type: 'MixerStatement'
  readonly properties: readonly Property[]
  readonly routings: readonly Routing[]
  readonly buses: readonly BusStatement[]
}

export interface BusStatement extends ASTNode {
  readonly type: 'BusStatement'
  readonly name: Identifier
  readonly properties: readonly Property[]
}

// Root Type

export interface Program extends ASTNode {
  readonly type: 'Program'
  readonly children: ReadonlyArray<Assignment | TrackStatement | MixerStatement>
}

// Factory

export function make<T extends keyof NodeByType> (
  type: T,
  location: SourceLocation,
  props: Omit<NodeByType[T], 'type' | 'location'>
): NodeByType[T] {
  return { type, location, ...(props as any) } as NodeByType[T]
}

export interface NodeByType {
  Identifier: Identifier
  NumberLiteral: NumberLiteral
  StringLiteral: StringLiteral
  PatternLiteral: PatternLiteral
  BinaryExpression: BinaryExpression

  Property: Property
  Call: Call
  Assignment: Assignment
  Routing: Routing

  TrackStatement: TrackStatement
  SectionStatement: SectionStatement
  MixerStatement: MixerStatement
  BusStatement: BusStatement

  Program: Program
}

export type AnyNode = NodeByType[keyof NodeByType]
