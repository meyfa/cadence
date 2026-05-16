import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { BaseModel } from '../../src/model/model.js'
import { findIdentifierAt } from '../../src/model/query.js'
import { getRangeAt } from '../helpers.js'

describe('analysis/query.ts', () => {
  describe('findIdentifierAt()', () => {
    it('finds the identifier at the given position', () => {
      const source = 'foo = bar(baz: qux)'

      const model: BaseModel = {
        rootScopeId: 'root',
        scopes: new Map(),
        identifiers: [
          {
            kind: 'VariableName',
            scopeId: 'root',
            name: 'foo',
            range: getRangeAt(source, source.indexOf('foo'), 'foo'.length)
          },
          {
            kind: 'Callee',
            scopeId: 'root',
            name: 'bar',
            range: getRangeAt(source, source.indexOf('bar'), 'bar'.length)
          },
          {
            kind: 'PropertyName',
            scopeId: 'root',
            name: 'baz',
            range: getRangeAt(source, source.indexOf('baz'), 'baz'.length)
          },
          {
            kind: 'VariableName',
            scopeId: 'root',
            name: 'qux',
            range: getRangeAt(source, source.indexOf('qux'), 'qux'.length)
          }
        ],
        bindings: [],
        bindingsByName: new Map(),
        bindingsByScope: new Map(),
        imports: []
      }

      const foo = findIdentifierAt(model, source.indexOf('foo') + 1)
      const bar = findIdentifierAt(model, source.indexOf('bar') + 1)
      const baz = findIdentifierAt(model, source.indexOf('baz') + 1)
      const qux = findIdentifierAt(model, source.indexOf('qux') + 1)

      assert.strictEqual(foo?.name, 'foo')
      assert.strictEqual(bar?.name, 'bar')
      assert.strictEqual(baz?.name, 'baz')
      assert.strictEqual(qux?.name, 'qux')
    })
  })
})
