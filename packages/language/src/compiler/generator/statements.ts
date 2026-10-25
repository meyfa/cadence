import { ast } from '@meyfa/cadence-ast'
import { setAll } from '@meyfa/cadence-utility'
import { BooleanFacet } from '../../type-system/base/boolean.ts'
import type { Value } from '../../type-system/types.ts'
import { assert, nonNull } from '../assert.ts'
import type { MutableScope } from './scopes.ts'
import { resolve } from './expressions/index.ts'

export interface Statement {
  readonly emissions: readonly Value[]
  readonly properties: ReadonlyMap<string, Value>
}

export function processStatement (scope: MutableScope, statement: ast.Statement): Statement {
  switch (statement.type) {
    case 'SimpleStatement':
      return processSimpleStatement(scope, statement)

    case 'IfStatement':
      return processIfStatement(scope, statement)
  }
}

function processSimpleStatement (scope: MutableScope, statement: ast.SimpleStatement): Statement {
  const values = statement.values.map((value) => resolve(scope, value))

  if (statement.name != null) {
    assert(values.length === 1)
    assert(!scope.resolutions.has(statement.name.name))
    scope.resolutions.set(statement.name.name, values[0])
  }

  const emissions = statement.emit ? values : []
  const properties = statement.expose
    ? new Map([[statement.name.name, nonNull(values.at(0))]])
    : new Map<string, Value>()

  return { emissions, properties }
}

function processIfStatement (scope: MutableScope, statement: ast.IfStatement): Statement {
  for (const branch of statement.branches) {
    const conditionValue = resolve(scope, branch.condition)
    if (BooleanFacet.get(conditionValue)) {
      return processStatements(scope, branch.children)
    }
  }

  return processStatements(scope, statement.elseBranch ?? [])
}

function processStatements (scope: MutableScope, statements: readonly ast.Statement[]): Statement {
  const emissions: Value[] = []
  const properties = new Map<string, Value>()

  for (const statement of statements) {
    const { emissions: childEmissions, properties: childProperties } = processStatement(scope, statement)
    emissions.push(...childEmissions)
    setAll(properties, childProperties)
  }

  return { emissions, properties }
}
