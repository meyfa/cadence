import { ast } from '@ast'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { check } from '../../src/compiler/checker.js'
import type { CompileError } from '../../src/compiler/error.js'
import { lex } from '../../src/lexer/lexer.js'
import { parse } from '../../src/parser/parser.js'
import { assertResultComplete } from '../test-utils.js'

/**
 * Helper function to lex and parse source code into an AST.
 * This assumes that the lexer and parser are implemented correctly.
 */
function lexAndParse (source: string): ast.Program {
  const tokens = lex(source)
  assertResultComplete(tokens)

  const result = parse(tokens.value)
  assertResultComplete(result)

  return result.value
}

function checkSource (source: string): readonly CompileError[] {
  return check(lexAndParse(source))
}

function assertValid (source: string): void {
  assert.deepStrictEqual(checkSource(source), [])
}

function assertErrorMessages (source: string, expectedMessages: string[]): void {
  assert.deepStrictEqual(
    checkSource(source).map((error) => error.message),
    expectedMessages
  )
}

describe('compiler/checker.ts', () => {
  describe('valid', () => {
    it('should accept an empty program', () => {
      assertValid('')
    })

    it('should accept use statements without alias', () => {
      const source = [
        'use "patterns" as *',
        'use "effects" as *'
      ].join('\n')

      assertValid(source)
    })

    it('should define names from imported libraries', () => {
      const source = [
        'use "instruments" as *',
        'myinstrument = sample("piano.wav")'
      ].join('\n')

      assertValid(source)
    })

    it('should accept imports with alias', () => {
      assertValid('use "effects" as myalias')
    })

    it('should accept a program with one track and unique parts', () => {
      const source = [
        'track {',
        '  part intro (4.bars) {}',
        '  part main (length: 8.bars) {}',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should accept variable declarations and usages in correct order', () => {
      const source = [
        'foo = 42',
        'bar = foo'
      ].join('\n')

      assertValid(source)
    })

    it('should allow shadowing of imported names', () => {
      const source = [
        'use "effects" as *',
        'gain = 3.db'
      ].join('\n')

      assertValid(source)
    })

    it('should accept delay effect time in beats or seconds', () => {
      const source = [
        'use "effects" as fx',
        'mixer {',
        '  bus bus1 {',
        '    effect fx.delay(mix: 0.25, time: 3.beats, feedback: 0.4)',
        '  }',
        '  bus bus2 {',
        '    effect fx.delay(mix: 0.25, time: 1.5.s, feedback: 0.4)',
        '  }',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should accept reverb effect decay in beats or seconds', () => {
      const source = [
        'use "effects" as fx',
        'mixer {',
        '  bus bus1 {',
        '    effect fx.reverb(mix: 0.25, decay: 3.beats)',
        '  }',
        '  bus bus2 {',
        '    effect fx.reverb(mix: 0.25, decay: 1.5.s)',
        '  }',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should allow parts and buses to shadow top-level variables', () => {
      const source = [
        'foo = 42',
        'track {',
        '  part foo (4.bars) {}',
        '}',
        'mixer {',
        '  bus foo {}',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should accept a pattern with interpolation', () => {
      const source = [
        'some_chord = [<D4 G4>]',
        'my_pattern = [C4 {some_chord + [<E4 A4>]} E4]'
      ].join('\n')

      assertValid(source)
    })

    it('should allow buses as sources in mixer', () => {
      const source = [
        'mixer {',
        '  bus bus1 { bus2 }',
        '  bus bus2 {}',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should accept lin curves', () => {
      assertValid('my_curve = curve[lin((-60).db, 0.db)]')
    })

    it('should accept curves with weighted segments', () => {
      assertValid('my_curve = curve[hold((-60).db):3 lin((-60).db, 0.db):1]')
    })

    it('should accept lin curves that omit the start after the first segment', () => {
      assertValid('my_curve = curve[hold((-60).db):3 lin(0.db):1]')
    })

    it('should accept hold curves that omit the value after the first segment', () => {
      assertValid('my_curve = curve[lin((-60).db, (-30).db):3 hold:1]')
    })

    it('should accept bus gain automation via explicit namespace', () => {
      const source = [
        'track {',
        '  part intro (4.bars) {',
        '    automate bus.main.gain as curve[lin((-20).db, 0.db)]',
        '  }',
        '}',
        'mixer {',
        '  bus main {}',
        '}'
      ].join('\n')

      assertValid(source)
    })
  })

  describe('invalid', () => {
    it('should reject imports of unknown libraries', () => {
      assertErrorMessages('use "unknownlib" as *', [
        'Unknown module "unknownlib"'
      ])
    })

    it('should reject duplicate non-alias imports', () => {
      const source = [
        'use "effects" as *',
        'use "effects" as *'
      ].join('\n')

      assertErrorMessages(source, [
        'Duplicate import of "effects"'
      ])
    })

    it('should not define names from non-imported libraries', () => {
      assertErrorMessages('myinstrument = sample("piano.wav")', [
        'Unknown identifier "sample"'
      ])
    })

    it('should reject unknown module export access', () => {
      const source = [
        'use "instruments" as inst',
        'myinstrument = inst.foobar'
      ].join('\n')

      assertErrorMessages(source, [
        'Module "instruments" has no export named "foobar"'
      ])
    })

    it('should reject variable usage before declaration', () => {
      const source = [
        'foo = bar',
        'bar = 100'
      ].join('\n')

      assertErrorMessages(source, [
        'Unknown identifier "bar"'
      ])
    })

    it('should reject variable reassignment', () => {
      const source = [
        'foo = 42',
        'foo = 100'
      ].join('\n')

      assertErrorMessages(source, [
        'Identifier "foo" is already defined'
      ])
    })

    it('should reject duplicate track blocks', () => {
      const source = [
        'track {}',
        'track {}'
      ].join('\n')

      assertErrorMessages(source, [
        'Multiple track definitions',
        'Multiple track definitions'
      ])
    })

    it('should reject duplicate properties', () => {
      assertErrorMessages('track(tempo: 120.bpm, tempo: 120.bpm) {}', [
        'Duplicate property named "tempo"'
      ])
    })

    it('should reject duplicate part blocks within a track', () => {
      const source = [
        'track {',
        '  part intro (4.bars) {}',
        '  part intro (8.bars) {}',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Duplicate part named "intro"'
      ])
    })

    it('should reject curves with non-numeric parameters', () => {
      assertErrorMessages('my_curve = curve[hold("not a number")]', [
        'Expected type number, got string'
      ])
    })

    it('should reject lin curves that omit the start for the first segment', () => {
      assertErrorMessages('my_curve = curve[lin(0.db)]', [
        'First curve segment cannot omit its first parameter'
      ])
    })

    it('should reject hold curves that omit the value for the first segment', () => {
      assertErrorMessages('my_curve = curve[hold]', [
        'First curve segment cannot omit its first parameter'
      ])
    })

    it('should reject omitted lin starts when the inherited and explicit units differ', () => {
      assertErrorMessages('my_curve = curve[hold((-60).db) lin(120.bpm)]', [
        'Expected type number(db), got number(bpm)'
      ])
    })

    it('should reject automations that target non-parameters', () => {
      const source = [
        'some_value = ""',
        'track {',
        '  part intro (4.bars) {',
        '    automate some_value as curve[hold(-60)]',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Expected type parameter, got string'
      ])
    })

    it('should reject duplicate mixer blocks', () => {
      const source = [
        'mixer {}',
        'mixer {}'
      ].join('\n')

      assertErrorMessages(source, [
        'Multiple mixer definitions',
        'Multiple mixer definitions'
      ])
    })

    it('should reject duplicate bus blocks within a mixer', () => {
      const source = [
        'mixer {',
        '  bus foo {}',
        '  bus foo {}',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Duplicate bus named "foo"'
      ])
    })

    it('should reject cyclic mixer routings', () => {
      const source = [
        'mixer {',
        '  bus bus1 { bus3 }',
        '  bus bus2 { bus1 }',
        '  bus bus3 { bus2 }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Cyclic routing: bus1 -> bus2 -> bus3 -> bus1'
      ])
    })

    it('should only report buses that are part of a cycle', () => {
      const source = [
        'mixer {',
        '  bus first { bus1 }',
        '  bus bus1 { bus2 }',
        '  bus bus2 { bus1 }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Cyclic routing: bus1 -> bus2 -> bus1'
      ])
    })

    it('should reject patterns with interpolation of the wrong type', () => {
      assertErrorMessages('my_pattern = [C4{42}E4]', [
        'Expected type pattern, got number'
      ])
    })

    it('should reject accessing prototype', () => {
      const source = [
        'use "instruments" as inst',
        'module_proto = inst.__proto__',
        'instrument_proto = inst.sample("piano.wav").__proto__',
        'module_constructor = inst.constructor',
        'instrument_constructor = inst.sample("piano.wav").constructor',
        'module_tostring = inst.toString',
        'instrument_tostring = inst.sample("piano.wav").toString'
      ].join('\n')

      assertErrorMessages(source, [
        'Module "instruments" has no export named "__proto__"',
        'Type instrument + record(gain) has no property named "__proto__"',
        'Module "instruments" has no export named "constructor"',
        'Type instrument + record(gain) has no property named "constructor"',
        'Module "instruments" has no export named "toString"',
        'Type instrument + record(gain) has no property named "toString"'
      ])
    })
  })
})
