import assert from 'node:assert'
import { describe, it } from 'node:test'
import { textFromString, toSourceRange } from '../../src/analysis/text.js'

describe('analysis/text.ts', () => {
  describe('textFromString()', () => {
    it('maps offsets to the correct line starts across mixed newlines', () => {
      const source = 'alpha\r\nbeta\rgamma\ndelta'
      const text = textFromString(source)

      assert.deepStrictEqual(text.lineAt(0), { from: 0, number: 1 })
      assert.deepStrictEqual(text.lineAt(source.indexOf('beta')), { from: 7, number: 2 })
      assert.deepStrictEqual(text.lineAt(source.indexOf('gamma')), { from: 12, number: 3 })
      assert.deepStrictEqual(text.lineAt(source.indexOf('delta')), { from: 18, number: 4 })
      assert.deepStrictEqual(text.lineAt(source.length), { from: 18, number: 4 })
    })

    it('throws for positions outside the document bounds', () => {
      const text = textFromString('tempo = 128.bpm')

      assert.throws(() => text.lineAt(-1), /Invalid position -1/)
      assert.throws(() => text.lineAt(text.length + 1), new RegExp(`Invalid position ${text.length + 1}`))
    })

    it('creates source ranges with 1-based line and column values', () => {
      const source = [
        'kick = sample("/samples/kick.wav")',
        'snare = sample("/samples/snare.wav")',
        '  clap = sample("/samples/clap.wav")',
        ''
      ].join('\n')

      const text = textFromString(source)
      const snareOffset = source.indexOf('snare =')
      const clapOffset = source.indexOf('clap =')

      assert.deepStrictEqual(toSourceRange(text, snareOffset, snareOffset + 'snare'.length), {
        offset: snareOffset,
        length: 'snare'.length,
        line: 2,
        column: 1
      })

      assert.deepStrictEqual(toSourceRange(text, clapOffset, clapOffset + 'clap'.length), {
        offset: clapOffset,
        length: 'clap'.length,
        line: 3,
        column: 3
      })
    })
  })
})
