import assert from 'node:assert'
import { describe, it } from 'node:test'
import { forEachChildNode } from '../../src/utilities/tree.ts'
import { getCadenceParser } from '../helpers.ts'

const cadenceParser = await getCadenceParser()

describe('utilities/tree.ts', () => {
  describe('forEachChildNode()', () => {
    it('invokes the callback for each direct child in source order', () => {
      const source = [
        'foo = 1',
        'bar = foo',
        ''
      ].join('\n')

      const tree = cadenceParser.parse(source)
      const visited: Array<{ name: string, from: number }> = []

      forEachChildNode(tree.topNode, (cursor) => {
        visited.push({ name: cursor.name, from: cursor.from })
      })

      assert.deepStrictEqual(visited, [
        { name: 'Assignment', from: 0 },
        { name: 'Assignment', from: 8 }
      ])
    })

    it('does not visit descendants of the children', () => {
      const tree = cadenceParser.parse('foo = 1\n')
      const names: string[] = []

      forEachChildNode(tree.topNode, (cursor) => {
        names.push(cursor.name)
      })

      assert.deepStrictEqual(names, ['Assignment'])
    })

    it('visits the children of a nested node', () => {
      const tree = cadenceParser.parse('foo = 1\n')
      const assignment = tree.topNode.firstChild
      assert.ok(assignment != null)

      const names: string[] = []

      forEachChildNode(assignment, (cursor) => {
        names.push(cursor.name)
      })

      assert.ok(names.length > 0)
      assert.ok(!names.includes('Assignment'))
    })

    it('does not invoke the callback for a node without children', () => {
      const tree = cadenceParser.parse('')
      let calls = 0

      forEachChildNode(tree.topNode, () => {
        calls++
      })

      assert.strictEqual(calls, 0)
    })

    it('does not move the original node', () => {
      const tree = cadenceParser.parse('foo = 1\nbar = foo\n')
      const root = tree.topNode

      forEachChildNode(root, () => {})

      assert.strictEqual(root.name, 'Program')
      assert.strictEqual(root.from, 0)
    })
  })
})
