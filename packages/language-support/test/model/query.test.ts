import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { BaseModel, IdentifierId, ScopeId } from '../../src/model/model.ts'
import { findIdentifierAt } from '../../src/model/query.ts'
import { getRangeAt } from '../helpers.ts'

describe('analysis/query.ts', () => {
  describe('findIdentifierAt()', () => {
    const source = '  foo = bar(baz: qux)  '

    const model: BaseModel = {
      rootScopeId: 'root' as ScopeId,
      scopes: [
        {
          id: 'root' as ScopeId,
          kind: 'root',
          range: getRangeAt(source, 0, source.length)
        }
      ],
      identifiers: [
        {
          id: '1' as IdentifierId,
          kind: 'plain',
          scopeId: 'root' as ScopeId,
          name: 'foo',
          range: getRangeAt(source, source.indexOf('foo'), 'foo'.length)
        },
        {
          id: '2' as IdentifierId,
          kind: 'plain',
          scopeId: 'root' as ScopeId,
          name: 'bar',
          range: getRangeAt(source, source.indexOf('bar'), 'bar'.length)
        },
        {
          id: '3' as IdentifierId,
          kind: 'argument-name',
          scopeId: 'root' as ScopeId,
          name: 'baz',
          range: getRangeAt(source, source.indexOf('baz'), 'baz'.length)
        },
        {
          id: '4' as IdentifierId,
          kind: 'plain',
          scopeId: 'root' as ScopeId,
          name: 'qux',
          range: getRangeAt(source, source.indexOf('qux'), 'qux'.length)
        }
      ],
      bindings: [],
      imports: []
    }

    it('finds the identifier at the given position', () => {
      const foo = findIdentifierAt(model, source.indexOf('foo') + 1)
      const bar = findIdentifierAt(model, source.indexOf('bar') + 1)
      const baz = findIdentifierAt(model, source.indexOf('baz') + 1)
      const qux = findIdentifierAt(model, source.indexOf('qux') + 1)

      assert.strictEqual(foo?.name, 'foo')
      assert.strictEqual(bar?.name, 'bar')
      assert.strictEqual(baz?.name, 'baz')
      assert.strictEqual(qux?.name, 'qux')
    })

    it('returns identifier when the position is at the start or end', () => {
      const atStart = findIdentifierAt(model, source.indexOf('foo'))
      const atEnd = findIdentifierAt(model, source.indexOf('foo') + 'foo'.length)

      assert.strictEqual(atStart?.name, 'foo')
      assert.strictEqual(atEnd?.name, 'foo')
    })

    it('returns undefined when the position is outside of any identifier', () => {
      const before = findIdentifierAt(model, source.indexOf('foo') - 1)
      const after = findIdentifierAt(model, source.indexOf('foo') + 'foo'.length + 1)

      assert.strictEqual(before, undefined)
      assert.strictEqual(after, undefined)
    })
  })
})
