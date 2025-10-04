export interface ASTNode {
  readonly type: string
}

// Basic Types

export interface Identifier extends ASTNode {
  readonly type: 'Identifier'
  readonly name: string
}

export interface NumberLiteral extends ASTNode {
  readonly type: 'NumberLiteral'
  readonly value: number
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

// Composite Types

export interface Property extends ASTNode {
  readonly type: 'Property'
  readonly key: Identifier
  readonly value: Literal
}

export interface Call extends ASTNode {
  readonly type: 'Call'
  readonly callee: Identifier
  readonly arguments: readonly Property[]
}

export interface Assignment extends ASTNode {
  readonly type: 'Assignment'
  readonly key: Identifier
  readonly value: Literal | Call
}

export interface Routing extends ASTNode {
  readonly type: 'Routing'
  readonly instrument: Identifier
  readonly pattern: PatternLiteral | Identifier
}

// Domain Types

export interface Track extends ASTNode {
  readonly type: 'Track'
  readonly properties: readonly Property[]
}

// Root Type

export interface Program extends ASTNode {
  readonly type: 'Program'
  readonly track?: Track
  readonly assignments: readonly Assignment[]
  readonly routings: readonly Routing[]
}
