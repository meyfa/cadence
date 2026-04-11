import assert from 'node:assert'
import { describe, it } from 'node:test'
import { fuzzyMatch } from '../../src/utilities/fuzzy-match.js'

describe('utilities/fuzzy-match.ts', () => {
  describe('fuzzyMatch', () => {
    it('should fail if the query is empty', () => {
      assert.strictEqual(fuzzyMatch({
        text: 'hello world',
        query: ''
      }), undefined)
    })

    it('should fail if the query is whitespace only', () => {
      assert.strictEqual(fuzzyMatch({
        text: 'hello world',
        query: '   \t  \n  '
      }), undefined)
    })

    it('should fail if the query is longer than the text', () => {
      assert.strictEqual(fuzzyMatch({
        text: 'foo',
        query: 'foobar'
      }), undefined)
    })

    it('should fail if no match is found', () => {
      assert.strictEqual(fuzzyMatch({
        text: 'hello world',
        query: 'xyz'
      }), undefined)
    })

    it('should fail if the match is not in order', () => {
      assert.strictEqual(fuzzyMatch({
        text: 'hello world',
        query: 'olh'
      }), undefined)
    })

    it('should fail for repeated characters in the query that are not repeated in the text', () => {
      assert.strictEqual(fuzzyMatch({
        text: 'abcdef',
        query: 'abbcd'
      }), undefined)
    })

    it('should succeed for a simple match', () => {
      assert.deepStrictEqual(fuzzyMatch({
        text: 'hello world',
        query: 'hello'
      }), {
        indices: [0, 1, 2, 3, 4]
      })

      assert.deepStrictEqual(fuzzyMatch({
        text: 'hello world',
        query: 'world'
      }), {
        indices: [6, 7, 8, 9, 10]
      })
    })

    it('should succeed for a fuzzy match', () => {
      assert.deepStrictEqual(fuzzyMatch({
        text: 'hello world',
        query: 'hlo'
      }), {
        indices: [0, 2, 4]
      })

      assert.deepStrictEqual(fuzzyMatch({
        text: 'hello world',
        query: 'wrd'
      }), {
        indices: [6, 8, 10]
      })
    })

    it('should be case-insensitive', () => {
      assert.deepStrictEqual(fuzzyMatch({
        text: 'Hello World',
        query: 'hlo'
      }), {
        indices: [0, 2, 4]
      })

      assert.deepStrictEqual(fuzzyMatch({
        text: 'Hello World',
        query: 'WRD'
      }), {
        indices: [6, 8, 10]
      })
    })

    it('should be insensitive to whitespace in the query', () => {
      assert.deepStrictEqual(fuzzyMatch({
        text: 'hello world',
        query: 'h l    o'
      }), {
        indices: [0, 2, 4]
      })
    })

    it('should be insensitive to accents', () => {
      assert.deepStrictEqual(fuzzyMatch({
        text: 'café',
        query: 'cafe'
      }), {
        indices: [0, 1, 2, 3]
      })

      assert.deepStrictEqual(fuzzyMatch({
        text: 'cafe',
        query: 'café'
      }), {
        indices: [0, 1, 2, 3]
      })
    })
  })
})
