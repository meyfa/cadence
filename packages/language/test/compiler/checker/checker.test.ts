import assert from 'node:assert'
import { describe, it } from 'node:test'
import { check } from '../../../src/compiler/checker/checker.js'
import type { CompileError } from '../../../src/compiler/error.js'
import { lex } from '../../../src/lexer/lexer.js'
import { parse } from '../../../src/parser/parser.js'
import { assertResultComplete } from '../../test-utils.js'

function checkSource (source: string): readonly CompileError[] {
  const tokens = lex(source)
  assertResultComplete(tokens)

  const ast = parse(tokens.value)
  assertResultComplete(ast)

  const checkResult = check(ast.value)

  return checkResult.complete ? [] : checkResult.error.errors
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

describe('compiler/checker/checker.ts', () => {
  describe('valid', () => {
    it('should accept an empty program', () => {
      assertValid('')
    })

    it('should accept number literals with valid units', () => {
      const source = [
        'foo1 = 120.bpm',
        'foo2 = -6.db',
        'foo3 = 440.hz',
        'foo4 = 2.s',
        'foo5 = 3.beats',
        'foo6 = 250.ms',
        'foo7 = 2.bars'
      ].join('\n')

      assertValid(source)
    })

    it('should accept use statements without alias', () => {
      const source = [
        'use "instruments" as *',
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
        'mixer {',
        '  bus foo {}',
        '}',
        'track {',
        '  part foo (4.bars) {}',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should allow scoped assignments to shadow top-level variables', () => {
      const source = [
        'shadowed_by_track = 100',
        'shadowed_by_mixer = 200',
        'shadowed_by_part = 300',
        'shadowed_by_bus = 400',
        '',
        'track {',
        '  shadowed_by_track = 101',
        '  part (4.bars) {',
        '    shadowed_by_part = 301',
        '  }',
        '}',
        '',
        'mixer {',
        '  shadowed_by_mixer = 201',
        '  bus foo {',
        '    shadowed_by_bus = 401',
        '  }',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should accept patterns with step arguments', () => {
      const source = [
        'my_pattern = [x C4(1.5):2 G4(vel: 0.75) A#4(0.5, 0.75) G4(gate: 0.5, vel: 0.75) -:3]'
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

    it('should accept built-in pattern functions', () => {
      const source = [
        'my_pattern = [C4 E4 G4].loop()',
        'my_filled_pattern = my_pattern.fill(2.bars)'
      ].join('\n')

      assertValid(source)
    })

    it('should allow instruments as sources in mixer', () => {
      const source = [
        'use "instruments" as *',
        'kick = sample("kick.wav")',
        'synth = sample("synth.wav")',
        'mixer {',
        '  bus main {',
        '    kick',
        '    renamed_synth = synth',
        '    renamed_synth',
        '  }',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should allow buses as sources in mixer', () => {
      const source = [
        'mixer {',
        '  bus bus0 {}',
        '  bus bus1 { bus0 }',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should accept bus references after the mixer declaration', () => {
      const source = [
        'mixer {',
        '  bus foo {}',
        '  bus bar {}',
        '}',
        'foo_gain = bus.foo.gain',
        'track {',
        '  part intro (4.bars) {',
        '    automate bus.bar.pan as ~[lin(-1, 1):1.bar]',
        '  }',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should accept curves with beat and bar length units', () => {
      assertValid('my_curve = ~[lin((-60).db, 0.db):4.bars lin(0.db, -60.db):16.beats]')
    })

    it('should accept curves with second length units', () => {
      assertValid('my_curve = ~[hold((-60).db):3.s lin((-60).db, 0.db):1.0.s]')
    })

    it('should accept curves with mixed length units', () => {
      assertValid('my_curve = ~[hold((-60).db):1.bar lin(0.db, -60.db):1.s]')
    })

    it('should accept lin curves that omit the start after the first segment', () => {
      assertValid('my_curve = ~[hold((-60).db):1.bar lin(0.db):1.bar]')
    })

    it('should accept hold curves that omit the value after the first segment', () => {
      assertValid('my_curve = ~[lin((-60).db, (-30).db):1.bar hold:1.bar]')
    })

    it('should accept bus gain automation via explicit namespace', () => {
      const source = [
        'mixer {',
        '  bus main {}',
        '}',
        'track {',
        '  part intro (4.bars) {',
        '    automate bus.main.gain as ~[lin((-20).db, 0.db):4.bars]',
        '  }',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should accept bus effect automation via explicit namespace', () => {
      const source = [
        'use "effects" as fx',
        'mixer {',
        '  bus main {',
        '    effect lp = fx.lowpass(1000.hz)',
        '  }',
        '}',
        'track {',
        '  part intro (4.bars) {',
        '    automate bus.main.lp.frequency as ~[lin(100.hz, 4000.hz):4.bars]',
        '  }',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should allow named effects to shadow other identifiers', () => {
      const source = [
        'use "effects" as fx',
        'lp = 42',
        'mixer {',
        '  bus main {',
        '    effect lp = fx.lowpass(1000.hz)',
        '  }',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should allow valid instrument definitions', () => {
      const source = [
        'use "sources" as src',
        '',
        'my_instrument = instrument {',
        '  foo = -6.db',
        '  voice {',
        '    bar = 440.hz',
        '    envelope ~[lin(0.db, -60.db):100.ms]',
        '    output src.sine(bar)',
        '  }',
        '  voice note {}',
        '  voice note {',
        '    baz = note',
        '    note_frequency = note.frequency',
        '    note_gate = note.gate',
        '    note_velocity = note.velocity',
        '',
        '    envelope ~[lin(-60.db, 0.db):30.ms lin(-10.db):note_gate lin(-60.db):10.ms]',
        '    output src.saw(note_frequency)',
        '  }',
        '}'
      ].join('\n')

      assertValid(source)
    })
  })

  describe('invalid', () => {
    it('should reject number literals with invalid units', () => {
      assertErrorMessages('foo = 120.unknownunit', [
        'Unknown unit "unknownunit"'
      ])
    })

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

    it('should reject variable reassignment in nested scopes', () => {
      const source = [
        'mixer {',
        '  in_mixer = 1',
        '  in_mixer = 2',
        '',
        '  bus main {',
        '    in_bus = 1',
        '    in_bus = 2',
        '  }',
        '}',
        '',
        'track {',
        '  in_track = 1',
        '  in_track = 2',
        '',
        '  part (4.bars) {',
        '    in_part = 1',
        '    in_part = 2',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Identifier "in_mixer" is already defined',
        'Identifier "in_bus" is already defined',
        'Identifier "in_track" is already defined',
        'Identifier "in_part" is already defined'
      ])
    })

    it('should reject duplicate track blocks', () => {
      const source = [
        'track {}',
        'track {}'
      ].join('\n')

      assertErrorMessages(source, [
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

    it('should reject conflicting part name and local variable name', () => {
      const source = [
        'track {',
        '  before = 42',
        '  part before (4.bars) {}',
        '  part after (4.bars) {}',
        '  after = 100',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Part name "before" conflicts with existing identifier',
        'Identifier "after" is already defined'
      ])
    })

    it('should reject variable usage from within the track scope', () => {
      const source = [
        'foo = bar',
        'track (my_tempo) {',
        '  my_tempo = 123.bpm',
        '  bar = 100',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Unknown identifier "bar"',
        'Unknown identifier "my_tempo"'
      ])
    })

    it('should reject variable usage from within the mixer scope', () => {
      const source = [
        'foo = bar',
        'mixer {',
        '  bar = 100',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Unknown identifier "bar"'
      ])
    })

    it('should reject patterns with step arguments of the wrong type', () => {
      assertErrorMessages('my_pattern = [C4:"foo"]', [
        'Expected type number, got string'
      ])

      assertErrorMessages('my_pattern = [C4("foo")]', [
        'Expected type number, got string'
      ])

      assertErrorMessages('my_pattern = [C4(gate: "foo")]', [
        'Expected type number, got string'
      ])

      assertErrorMessages('my_pattern = [C4(vel: "foo")]', [
        'Expected type number, got string'
      ])

      assertErrorMessages('my_pattern = [C4(0.5, "foo")]', [
        'Expected type number, got string'
      ])
    })

    it('should reject curves with non-numeric parameters', () => {
      assertErrorMessages('my_curve = ~[hold("not a number"):1.bar]', [
        'Expected type number, got string'
      ])
    })

    it('should reject lin curves that omit the start for the first segment', () => {
      assertErrorMessages('my_curve = ~[lin(0.db):1.bar]', [
        'First curve segment cannot omit its first parameter'
      ])
    })

    it('should reject hold curves that omit the value for the first segment', () => {
      assertErrorMessages('my_curve = ~[hold:1.bar]', [
        'First curve segment cannot omit its first parameter'
      ])
    })

    it('should reject curves when the units differ between segments', () => {
      assertErrorMessages('my_curve = ~[hold(0.db):1.bar hold(100.hz):1.bar]', [
        'Curve segments must have the same unit'
      ])
    })

    it('should reject omitted lin starts when the inherited and explicit units differ', () => {
      assertErrorMessages('my_curve = ~[hold((-60).db):1.bar lin(120.bpm):1.bar]', [
        'Expected type number(db), got number(bpm)'
      ])
    })

    it('should use segment unit if only the segment length is invalid', () => {
      // If the first segment is entirely discarded by the compiler, then
      // the second would emit a second error: 'Expected type number, got number(hz)',
      // which is obviously not correct.
      assertErrorMessages('my_curve = ~[lin(10.hz, 20.hz):unknown lin(30.hz):1.bar]', [
        'Unknown identifier "unknown"'
      ])
    })

    it('should reject curves with invalid length units', () => {
      assertErrorMessages('my_curve = ~[hold((-60).db):42]', [
        'Expected type number(beats) | number(s), got number'
      ])
    })

    it('should reject automations that target non-parameters', () => {
      const source = [
        'some_value = ""',
        'track {',
        '  part intro (4.bars) {',
        '    automate some_value as ~[hold(-60):1.bar]',
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

    it('should reject conflicting bus name and local variable name', () => {
      const source = [
        'mixer {',
        '  before = 42',
        '  bus before {}',
        '  bus after {}',
        '  after = 100',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Bus name "before" conflicts with existing identifier',
        'Identifier "after" is already defined'
      ])
    })

    it('should reject duplicate named effects within the same bus', () => {
      const source = [
        'use "effects" as fx',
        'mixer {',
        '  bus main {',
        '    effect lp = fx.lowpass(1000.hz)',
        '    effect lp = fx.highpass(200.hz)',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Duplicate effect name "lp"'
      ])
    })

    it('should reject named effects that collide with built-in bus fields', () => {
      const source = [
        'use "effects" as fx',
        'mixer {',
        '  bus main {',
        '    effect gain = fx.lowpass(1000.hz)',
        '    effect pan = fx.highpass(200.hz)',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Effect name "gain" conflicts with bus property of the same name',
        'Effect name "pan" conflicts with bus property of the same name'
      ])
    })

    it('should reject buses as sources in mixer before their declaration', () => {
      const source = [
        'mixer {',
        '  bus bus0 { bus1 }',
        '  bus bus1 {}',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Unknown identifier "bus1"'
      ])
    })

    it('should reject bus referring to itself as a source', () => {
      const source = [
        'mixer {',
        '  bus bus0 { bus0 }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Unknown identifier "bus0"',
        'Cyclic routing: bus0 -> bus0'
      ])
    })

    it('should reject cyclic mixer routings', () => {
      const source = [
        'mixer {',
        '  bus bus0 { bus2 }',
        '  bus bus1 { bus0 }',
        '  bus bus2 { bus1 }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Unknown identifier "bus2"',
        'Cyclic routing: bus0 -> bus1 -> bus2 -> bus0'
      ])
    })

    it('should only report buses that are part of a cycle', () => {
      const source = [
        'mixer {',
        '  bus bus0 { bus1 }',
        '  bus bus1 { bus2 }',
        '  bus bus2 { bus1 }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Unknown identifier "bus1"',
        'Unknown identifier "bus2"',
        'Cyclic routing: bus1 -> bus2 -> bus1'
      ])
    })

    it('should reject patterns with interpolation of the wrong type', () => {
      assertErrorMessages('my_pattern = [C4{42}E4]', [
        'Expected type pattern, got number'
      ])
    })

    it('should reject unknown built-in pattern functions', () => {
      assertErrorMessages('my_pattern = [C4 E4 G4].foobar()', [
        'Type pattern has no property named "foobar"'
      ])
    })

    it('should reject built-in pattern functions used on non-patterns', () => {
      assertErrorMessages('my_pattern = "-".loop()', [
        'Type string has no property named "loop"'
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

    it('should report errors from inside binary expressions', () => {
      const source = [
        'use "instruments" as *',
        'my_pattern = [x] + [x].fill()'
      ].join('\n')

      assertErrorMessages(source, [
        'Missing required argument "duration"'
      ])
    })

    it('should report errors in instrument definitions', () => {
      const source = [
        'my_instrument = instrument {',
        '  foo = 42',
        '  foo = 100',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Identifier "foo" is already defined'
      ])
    })

    it('should report errors in voice statements', () => {
      const source = [
        'use "sources" as src',
        '',
        'my_instrument = instrument {',
        '  voice {',
        '    bar = 440.hz',
        '    bar = 880.hz',
        '    output src.sine(440)',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Identifier "bar" is already defined',
        'Expected type number(hz), got number'
      ])
    })

    it('should report switched output and envelope values', () => {
      const source = [
        'use "sources" as src',
        '',
        'my_instrument = instrument {',
        '  voice {',
        '    output ~[lin(0.db, -60.db):100.ms]',
        '    envelope src.sine(440.hz)',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Expected type source, got curve(db)',
        'Expected type curve(db), got source'
      ])
    })

    it('should reject accessing note from another voice', () => {
      const source = [
        'my_instrument = instrument {',
        '  voice note {}',
        '  voice {',
        '    baz = note',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Unknown identifier "note"'
      ])
    })

    it('should reject reassignment of the note binding', () => {
      const source = [
        'my_instrument = instrument {',
        '  voice note {',
        '    note = 440.hz',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Identifier "note" is already defined'
      ])
    })

    it('should reject multiple outputs in a voice', () => {
      const source = [
        'use "sources" as src',
        '',
        'my_instrument = instrument {',
        '  voice {',
        '    output src.sine(440.hz)',
        '    output src.sine(880.hz)',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Multiple output statements in a voice'
      ])
    })

    it('should reject multiple envelopes in a voice', () => {
      const source = [
        'my_instrument = instrument {',
        '  voice {',
        '    envelope ~[lin(0.db, -60.db):100.ms]',
        '    envelope ~[lin(-60.db, 0.db):100.ms]',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Multiple envelope statements in a voice'
      ])
    })

    it('should reject blocking effects in non-blocking contexts', () => {
      const source = [
        'use "instruments" as *',
        'my_instrument = instrument {',
        '  voice {',
        '    foo = sample("piano.wav")',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Function "sample" may block and cannot be called from a realtime context'
      ])
    })

    it('should reject instrument expressions in non-blocking contexts', () => {
      const source = [
        'my_instrument = instrument {',
        '  voice {',
        '    foo = instrument {}',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Cannot construct an instrument in a realtime context'
      ])
    })

    it('should enforce ordering in the global scope', () => {
      const source = [
        'track (my_tempo) {}',
        'my_tempo = 120.bpm'
      ].join('\n')

      assertErrorMessages(source, [
        'Unknown identifier "my_tempo"'
      ])
    })

    it('should reject bus references before the mixer declaration', () => {
      const source = [
        'foo_gain = bus.foo.gain',
        'track {',
        '  part intro (4.bars) {',
        '    automate bus.bar.pan as ~[lin(-1, 1):1.bar]',
        '  }',
        '}',
        'mixer {',
        '  bus foo {}',
        '  bus bar {}',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Namespace "bus" has no member named "foo"',
        'Namespace "bus" has no member named "bar"'
      ])
    })

    it('should enforce ordering within mixer', () => {
      const source = [
        'mixer {',
        '  bus bus0 (gain: level) {}',
        '  level = -6.db',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Unknown identifier "level"'
      ])
    })

    it('should enforce ordering within instrument definitions', () => {
      const source = [
        'my_instrument = instrument {',
        '  voice {',
        '    bar = foo',
        '  }',
        '  foo = -6.db',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Unknown identifier "foo"'
      ])
    })
  })
})
