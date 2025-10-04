export interface ASTNode {
  readonly type: string
}

// Literal Types

export interface NumberLiteral extends ASTNode {
  readonly type: 'NumberLiteral'
  readonly value: number
}

// Composite Types

export interface Property extends ASTNode {
  readonly type: 'Property'
  readonly key: string
  readonly value: NumberLiteral
}

export interface Assignment extends ASTNode {
  readonly type: 'Assignment'
  readonly key: string
  readonly value: Pattern
}

// Domain Types

export type Step = 'rest' | 'hit'

export interface Pattern extends ASTNode {
  readonly type: 'Pattern'
  readonly steps: Step[]
}

export interface Track extends ASTNode {
  readonly type: 'Track'
  readonly properties: Property[]
}

// Root Type

export interface Program extends ASTNode {
  readonly type: 'Program'
  readonly track?: Track
  readonly patterns: Record<string, Pattern>
}
