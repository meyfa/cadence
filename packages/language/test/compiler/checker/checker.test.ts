import type { SourceRange } from '@meyfa/cadence-ast'
import { ast, getEmptySourceRange } from '@meyfa/cadence-ast'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { check } from '../../../src/compiler/checker/checker.ts'
import { CompileError } from '../../../src/compiler/error.ts'
import { lex } from '../../../src/lexer/lexer.ts'
import { parse } from '../../../src/parser/parser.ts'
import { NumberFacet } from '../../../src/type-system/base/number.ts'
import { InstrumentFacet } from '../../../src/type-system/domain/instrument.ts'
import { makeSchema } from '../../../src/type-system/schema.ts'
import { assertResultComplete } from '../../test-utils.ts'
import { collapseRanges, createFixtureTests } from '../../fixture-utils.ts'

function checkSource (source: string, fileName?: string): readonly CompileError[] {
  const tokens = lex(source, fileName)
  assertResultComplete(tokens)

  const ast = parse(tokens.value)
  assertResultComplete(ast)

  const checkResult = check(ast.value)

  return checkResult.complete ? [] : checkResult.error.errors
}

function assertValid (source: string): void {
  assert.deepStrictEqual(checkSource(source), [])
}

function assertErrors (source: string, expectedErrors: readonly CompileError[]): void {
  const actualErrors = checkSource(source)

  // Cannot compare the objects directly due to differences in stack traces.
  assert.deepStrictEqual(
    actualErrors.map((error) => error.message),
    expectedErrors.map((error) => error.message)
  )

  assert.deepStrictEqual(
    actualErrors.map((error) => error.range),
    expectedErrors.map((error) => error.range)
  )
}

function assertErrorMessages (source: string, expectedMessages: readonly string[]): void {
  assert.deepStrictEqual(
    checkSource(source).map((error) => error.message),
    expectedMessages
  )
}

function rangeOf (source: string, substring: string, position?: number): SourceRange {
  const offset = position ?? source.indexOf(substring)

  return {
    offset,
    length: substring.length,
    line: source.slice(0, offset).split('\n').length,
    column: offset - source.lastIndexOf('\n', offset - 1)
  }
}

describe('compiler/checker/checker.ts', async () => {
  await createFixtureTests({
    component: 'checker',
    compute: (fixture) => checkSource(fixture.source, fixture.name),
    postProcess: collapseRanges
  })

  describe('valid', () => {
    it('should accept imports without alias', () => {
      const source = [
        'use "instruments" as *',
        'use "effects" as *'
      ].join('\n')

      assertValid(source)
    })

    it('should accept imports with alias', () => {
      assertValid('use "effects" as myalias')
    })

    it('should define names from imported libraries', () => {
      const source = [
        'use "instruments" as *',
        'myinstrument = sample("piano.wav")'
      ].join('\n')

      assertValid(source)
    })

    it('should accept global builtins', () => {
      const source = [
        'foo = play',
        'bar = automate'
      ].join('\n')

      assertValid(source)
    })

    it('should allow shadowing of global builtins', () => {
      const source = [
        'play = 1',
        'foo = play',
        '',
        'automate = 2',
        'bar = automate',
        ''
      ].join('\n')

      assertValid(source)
    })

    it('should accept a program with one track and unique parts', () => {
      const source = [
        '& track {',
        '  & part (4.bars) {}',
        '  & part (length: 8.bars) {}',
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
        '& mixer {',
        '  & bus {',
        '    & fx.delay(mix: 0.25, time: 3.beats, feedback: 0.4)',
        '  }',
        '  & bus {',
        '    & fx.delay(mix: 0.25, time: 1.5.s, feedback: 0.4)',
        '  }',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should accept reverb effect decay in beats or seconds', () => {
      const source = [
        'use "effects" as fx',
        '& mixer {',
        '  & bus {',
        '    & fx.reverb(mix: 0.25, decay: 3.beats)',
        '  }',
        '  & bus {',
        '    & fx.reverb(mix: 0.25, decay: 1.5.s)',
        '  }',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should accept part and bus labels', () => {
      const source = [
        '& mixer {',
        '  & bus ("Foo") {}',
        '  & bus (label: "Bar") {}',
        '}',
        '& track {',
        '  & part (4.bars, "Foo") {}',
        '  & part (4.bars, label: "Bar") {}',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should allow scoped assignments to shadow top-level variables', () => {
      const source = [
        'shadowed_in_track = 100',
        'shadowed_in_mixer = 200',
        'shadowed_in_part = 300',
        'shadowed_in_bus = 400',
        '',
        '& track {',
        '  shadowed_in_track = 101',
        '  & part (4.bars) {',
        '    shadowed_in_part = 301',
        '  }',
        '}',
        '',
        '& mixer {',
        '  shadowed_in_mixer = 201',
        '  & bus {',
        '    shadowed_in_bus = 401',
        '  }',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should accept property exposure', () => {
      const source = [
        '& m = mixer {',
        '  @mixer_property = 42',
        '  & @b = bus {',
        '    @bus_property = 42',
        '  }',
        '}',
        '',
        '& t = track {',
        '  @track_property = 42',
        '  & @p = part (4.bars) {',
        '    @part_property = 42',
        '  }',
        '}',
        '',
        'access_mixer_property = m.mixer_property',
        'access_bus_property = m.b.bus_property',
        'access_track_property = t.track_property',
        'access_part_property = t.p.part_property'
      ].join('\n')

      assertValid(source)
    })

    it('should accept simple function definitions', () => {
      const source = [
        'my_function = () {',
        '  foo = 42',
        '  & foo',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should accept function definitions with parameters', () => {
      const source = [
        'my_function = (param0: number.hz, param1: number, param2: string) {',
        '  & param0 * param1',
        '}',
        '',
        'foo = my_function(440.hz, 2, "hello")'
      ].join('\n')

      assertValid(source)
    })

    it('should accept function definitions with optional parameters', () => {
      const source = [
        'my_function = (param0: number.hz, param1?: number, param2?: string) {',
        '  & param0',
        '}',
        '',
        'foo = my_function(440.hz)',
        'bar = my_function(440.hz, 2)',
        'baz = my_function(440.hz, 2, "hello")'
      ].join('\n')

      assertValid(source)
    })

    it('should accept higher-order functions', () => {
      const source = [
        'apply = (fn: (arg: number.bpm): number.bpm, value: number) {',
        '  & fn(value.bpm)',
        '}',
        '',
        'foo = apply((arg: number.bpm) { & arg * 2 }, 120)'
      ].join('\n')

      assertValid(source)
    })

    it('should accept higher-order functions with optional parameters', () => {
      const source = [
        'apply = (fn: (arg: number.bpm, optional_arg?: number): number.bpm, value: number) {',
        '  & fn(value.bpm)',
        '}',
        '',
        'foo = apply((arg: number.bpm, optional_arg?: number) { & arg * 2 }, 120)'
      ].join('\n')

      assertValid(source)
    })

    it('should accept capabilities on function-typed parameters', () => {
      const source = [
        'apply = (fn: (): instrument !may_block) {',
        '  & fn()',
        '}',
        '',
        'foo = apply(() { & instrument {} })',
        '',
        // calling with a non-blocking function should also be valid
        'inst = instrument {}',
        'bar = apply(() { & inst })'
      ].join('\n')

      assertValid(source)
    })

    it('should accept record types', () => {
      const source = [
        'my_function = (param: {foo: number, bar: string}) {',
        '  & param.foo',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should merge identical and complementary composite types', () => {
      const source = [
        'func0 = (p: string + string) { & p }',
        'func1 = (p: number.db + number.db) { & p }',
        'func2 = (p: ((arg: number): number) + ((arg: number): number)) { & p(42) }',
        'func4 = (p: { a: string } + { a: string }) { & p.a }',
        'func3 = (p: { a: string } + { b: number }) { & { @c = p.a @d = p.b } }'
      ].join('\n')

      assertValid(source)
    })

    it('should accept record values', () => {
      const source = [
        'empty_record = {}',
        '',
        'my_record = {',
        '  @foo = 42',
        '  @bar = "hello"',
        '}',
        '',
        'access_foo = my_record.foo',
        'access_bar = my_record.bar'
      ].join('\n')

      assertValid(source)
    })

    it('should allow blocking calls in functions', () => {
      const source = [
        'use "instruments" as inst',
        'my_function = () {',
        '  & inst.sample("piano.wav")',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should register function specs in the semantic model', () => {
      const pureFunction = ast.make('Function', getEmptySourceRange(), {
        parameters: [],
        children: [
          ast.make('SimpleStatement', getEmptySourceRange(), {
            emit: true,
            expose: false,
            values: [
              ast.make('Number', getEmptySourceRange(), { value: 42 })
            ]
          })
        ]
      })

      const blockingFunction = ast.make('Function', getEmptySourceRange(), {
        parameters: [],
        children: [
          ast.make('SimpleStatement', getEmptySourceRange(), {
            emit: true,
            expose: false,
            values: [
              ast.make('Instrument', getEmptySourceRange(), {
                arguments: [],
                children: []
              })
            ]
          })
        ]
      })

      const program = ast.make('Program', getEmptySourceRange(), {
        imports: [],
        children: [
          ast.make('SimpleStatement', getEmptySourceRange(), {
            emit: false,
            expose: false,
            name: ast.make('Identifier', getEmptySourceRange(), { name: 'pure_function' }),
            values: [pureFunction]
          }),
          ast.make('SimpleStatement', getEmptySourceRange(), {
            emit: false,
            expose: false,
            name: ast.make('Identifier', getEmptySourceRange(), { name: 'blocking_function' }),
            values: [blockingFunction]
          })
        ]
      })

      const checkResult = check(program)
      assertResultComplete(checkResult)

      const semanticModel = checkResult.value.semantic

      const pureFunctionSpec = semanticModel.getFunctionSpec(pureFunction)
      assert.deepStrictEqual(pureFunctionSpec, {
        parameters: makeSchema([]),
        returnType: NumberFacet.with(undefined).type(),
        capabilities: { mayBlock: false }
      })

      const blockingFunctionSpec = semanticModel.getFunctionSpec(blockingFunction)
      assert.deepStrictEqual(blockingFunctionSpec, {
        parameters: makeSchema([]),
        returnType: InstrumentFacet.type(),
        capabilities: { mayBlock: true }
      })
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

    it('should accept pattern to instrument routing', () => {
      const source = [
        'use "instruments" as *',
        '& track {',
        '  & part (1.bar) {',
        '    & play(sine(), [C4 E4 G4])',
        '  }',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should allow instruments as sources in bus', () => {
      const source = [
        'use "instruments" as *',
        '',
        'kick = sample("kick.wav")',
        'synth = sample("synth.wav")',
        '',
        '& mixer {',
        '  & bus {',
        '    & kick',
        '    renamed_synth = synth',
        '    & renamed_synth',
        '  }',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should allow buses as sources in bus', () => {
      const source = [
        '& mixer {',
        '  & bus0 = bus {}',
        '  & bus { & bus0 }',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should accept both instruments and buses as sources in bus', () => {
      const source = [
        'inst = instrument {}',
        '& mixer {',
        '  & bus0 = bus {}',
        '  & bus {',
        '    & inst',
        '    & bus0',
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

    it('should accept interpolated curves and inherit their final segment value', () => {
      const source = [
        'previous = ~[lin(-60.db, -30.db):1.bar]',
        'my_curve = ~[{previous} lin(0.db):1.bar]'
      ].join('\n')

      assertValid(source)
    })

    it('should accept interpolation of curves without units', () => {
      const source = [
        'previous = ~[hold(0):1.bar]',
        'my_curve = ~[{previous} lin(1):1.bar]'
      ].join('\n')

      assertValid(source)
    })

    it('should accept bus gain automation', () => {
      const source = [
        '& m = mixer {',
        '  & @test_bus = bus {}',
        '}',
        '& track {',
        '  & part (4.bars) {',
        '    & automate(m.test_bus.gain, ~[lin((-20).db, 0.db):4.bars])',
        '  }',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should accept bus effect automation', () => {
      const source = [
        'use "effects" as fx',
        '& m = mixer {',
        '  & @test_bus = bus {',
        '    & @lp = fx.lowpass(1000.hz)',
        '  }',
        '}',
        '& track {',
        '  & part (4.bars) {',
        '    & automate(m.test_bus.lp.frequency, ~[lin(100.hz, 4000.hz):4.bars])',
        '  }',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should allow named effects to shadow other identifiers', () => {
      const source = [
        'use "effects" as fx',
        'lp = 42',
        '& mixer {',
        '  & bus {',
        '    & @lp = fx.lowpass(1000.hz)',
        '  }',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should allow instrument definitions without voices', () => {
      const source = [
        'use "sources" as src',
        '',
        'my_instrument = instrument {',
        '  foo = -6.db',
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
        '  & voice {',
        '    bar = 440.hz',
        '    & ~[lin(0.db, -60.db):100.ms]',
        '    & src.sine(bar)',
        '  }',
        '  & voice note {',
        '    baz = note',
        '    note_frequency = note.frequency',
        '    note_gate = note.gate',
        '    note_velocity = note.velocity',
        '',
        '    & ~[lin(-60.db, 0.db):30.ms lin(-10.db):note_gate lin(-60.db):10.ms]',
        '    & src.saw(note_frequency)',
        '  }',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should allow property exposure in instrument definitions', () => {
      const source = [
        'my_instrument = instrument {',
        '  @foo = -6.db',
        '}',
        'access_foo = my_instrument.foo'
      ].join('\n')

      assertValid(source)
    })

    it('should allow label for instrument definitions', () => {
      const source = [
        'instrument0 = instrument ("My Instrument") {}',
        'instrument1 = instrument (label: "My Instrument") {}'
      ].join('\n')

      assertValid(source)
    })

    it('should allow empty if statements', () => {
      const source = [
        'if true {}',
        'if false {}, else {}'
      ].join('\n')

      assertValid(source)
    })

    it('should allow assignments within if statements', () => {
      const source = [
        'if true {',
        '  foo = 100',
        '  bar = foo + 1', // 101
        '}, else {',
        '  foo = 200',
        '  bar = foo + 2', // 202
        '}',
        '',
        'if true {',
        '  baz = 200', // non-definite assignment
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should allow emission within if statements', () => {
      const source = [
        'use "sources" as src',
        '',
        'if true {',
        '  & track (123.bpm) {}',
        '}, else {',
        '  & track (234.bpm) {}',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should allow conditional function returns of the same type', () => {
      const source = [
        'my_function = () {',
        '  if true {',
        '    & 42',
        '  }, else {',
        '    & 100',
        '  }',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should intersect types of conditional function returns', () => {
      const source = [
        'my_function = () {',
        '  if true {',
        '    & instrument {',
        '      @foo = 42',
        '      @bar = "hello"',
        '    }',
        '  }, else {',
        '    & instrument {',
        '      @foo = 100',
        '      @baz = 3.db',
        '    }',
        '  }',
        '}',
        '',
        'access_foo = my_function().foo',
        'access_instrument = play(my_function(), [C5])'
      ].join('\n')

      assertValid(source)
    })

    it('should allow conditional property exposure', () => {
      const source = [
        'my_instrument = instrument {',
        '  if true {',
        '    @foo = 42',
        '  }',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should intersect types of conditional property exposure', () => {
      const source = [
        'my_instrument = instrument {',
        '  if true {',
        '    @foo = { @bar = 42 @str = "hello" }',
        '    @x = 100.hz',
        '  }, else {',
        '    @foo = { @bar = 100 @num = 3.db }',
        '    @y = 200.hz',
        '  }',
        '}',
        '',
        'access_bar = my_instrument.foo.bar'
      ].join('\n')

      assertValid(source)
    })

    it('should allow access to conditional properties in the same branch', () => {
      const source = [
        'my_record = {',
        '  if true {',
        '    @foo = 42',
        '    @bar = foo + 1',
        '  }',
        '}'
      ].join('\n')

      assertValid(source)
    })

    it('should allow valid equality comparisons', () => {
      const source = [
        'number_eq = 42 == 100',
        'number_neq = 42 != 100',
        'string_eq = "hello" == "world"',
        'string_neq = "hello" != "world"',
        'boolean_eq = true == false',
        'boolean_neq = true != false'
      ].join('\n')

      assertValid(source)
    })
  })

  describe('invalid', () => {
    it('should reject addition of incompatible types', () => {
      const source = [
        'foo = 42 + "hello"'
      ].join('\n')

      assertErrorMessages(source, [
        'Incompatible operands for "+": number, string'
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
        '& mixer {',
        '  in_mixer = 1',
        '  in_mixer = 2',
        '',
        '  & bus {',
        '    in_bus = 1',
        '    in_bus = 2',
        '  }',
        '}',
        '',
        '& track {',
        '  in_track = 1',
        '  in_track = 2',
        '',
        '  & part (4.bars) {',
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

    it('should reject property exposure in the global scope', () => {
      const source = [
        '@foo = 42'
      ].join('\n')

      assertErrorMessages(source, [
        'Cannot expose properties in the global scope'
      ])
    })

    it('should reject duplicate property exposures', () => {
      const source = [
        '& mixer {',
        '  @foo = 42',
        '  @foo = 100',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Identifier "foo" is already defined',
        'Duplicate property "foo"'
      ])
    })

    it('should reject property exposures that collide with existing names', () => {
      const source = [
        'b = bus {',
        '  @gain = 42',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Duplicate property "gain"'
      ])
    })

    it('should reject emission in record values', () => {
      const source = [
        'my_record = {',
        '  & 42',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Cannot emit values in this context (record)'
      ])
    })

    it('should reject duplicate track emissions', () => {
      const source = [
        '& track {} // 0',
        '& track {} // 1'
      ].join('\n')

      assertErrors(source, [
        new CompileError(
          'Duplicate emission into slot "track" of type track which accepts at most one value',
          rangeOf(source, 'track {}', source.indexOf('track {} // 1'))
        )
      ])
    })

    it('should reject duplicate properties', () => {
      assertErrorMessages('& track (tempo: 120.bpm, tempo: 120.bpm) {}', [
        'Duplicate argument named "tempo"'
      ])
    })

    it('should reject variable usage from within the track scope', () => {
      const source = [
        '& track (my_tempo) {',
        '  my_tempo = 123.bpm',
        '  bar = 100',
        '}',
        'foo = bar'
      ].join('\n')

      assertErrorMessages(source, [
        'Unknown identifier "my_tempo"',
        'Unknown identifier "bar"'
      ])
    })

    it('should reject variable usage from within the mixer scope', () => {
      const source = [
        '& mixer {',
        '  bar = 100',
        '}',
        'foo = bar'
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
        'Expected type number for argument "gate", got string'
      ])

      assertErrorMessages('my_pattern = [C4(gate: "foo")]', [
        'Expected type number for argument "gate", got string'
      ])

      assertErrorMessages('my_pattern = [C4(vel: "foo")]', [
        'Expected type number for argument "vel", got string'
      ])

      assertErrorMessages('my_pattern = [C4(0.5, "foo")]', [
        'Expected type number for argument "vel", got string'
      ])
    })

    it('should reject curves with non-numeric parameters', () => {
      assertErrorMessages('my_curve = ~[hold("not a number"):1.bar]', [
        'Expected type number, got string'
      ])
    })

    it('should reject lin curves that omit the start for the first segment', () => {
      assertErrorMessages('my_curve = ~[lin(0.db):1.bar]', [
        'First curve segment cannot omit its first argument'
      ])
    })

    it('should reject hold curves that omit the value for the first segment', () => {
      assertErrorMessages('my_curve = ~[hold:1.bar]', [
        'First curve segment cannot omit its first argument'
      ])
    })

    it('should reject curves when the units differ between segments', () => {
      assertErrorMessages('my_curve = ~[hold(0.db):1.bar hold(100.hz):1.bar]', [
        'Curve segments must have the same unit'
      ])
    })

    it('should reject curves when interpolation units differ from segments', () => {
      const source = [
        'previous = ~[hold(0.db):1.bar]',
        'my_curve = ~[{previous} hold(100.hz):1.bar]'
      ].join('\n')

      assertErrorMessages(source, [
        'Curve segments must have the same unit'
      ])
    })

    it('should reject empty curves', () => {
      assertErrorMessages('my_curve = ~[]', [
        'Curve must have at least one segment'
      ])
    })

    it('should reject interpolation of non-curves', () => {
      assertErrorMessages('my_curve = ~[{42}]', [
        'Expected type curve, got number'
      ])
    })

    it('should reject omitted lin starts when the inherited and explicit units differ', () => {
      assertErrorMessages('my_curve = ~[hold((-60).db):1.bar lin(120.bpm):1.bar]', [
        'Expected type number.db, got number.bpm'
      ])
    })

    it('should use segment unit if only the segment length is invalid', () => {
      // If the first segment is entirely discarded by the compiler, then
      // the second would emit a second error: 'Expected type number, got number.hz',
      // which is obviously not correct.
      assertErrorMessages('my_curve = ~[lin(10.hz, 20.hz):unknown lin(30.hz):1.bar]', [
        'Unknown identifier "unknown"'
      ])
    })

    it('should reject curves with invalid length units', () => {
      assertErrorMessages('my_curve = ~[hold((-60).db):42]', [
        'Expected type (number.beats | number.s), got number'
      ])
    })

    it('should reject part emissions that are not routing or automation', () => {
      const source = [
        '& track {',
        '  & part (4.bars) {',
        '    & 42',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Unexpected emitted value of type number; expected one of: routing, automation'
      ])
    })

    it('should reject automations that target non-parameters', () => {
      const source = [
        'some_value = ""',
        '& track {',
        '  & part (4.bars) {',
        '    & automate(some_value, ~[hold(-60):1.bar])',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Expected type parameter for argument "target", got string'
      ])
    })

    it('should reject automations with mismatched units', () => {
      const source = [
        'use "effects" as fx',
        'lp = fx.lowpass(1000.hz)',
        '& track {',
        '  & part (4.bars) {',
        '    & automate(lp.frequency, ~[hold(0.db):1.bar])',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Expected type curve.hz for argument "curve", got curve.db'
      ])
    })

    it('should reject duplicate mixer emissions', () => {
      const source = [
        '& mixer {} // 0',
        '& mixer {} // 1'
      ].join('\n')

      assertErrors(source, [
        new CompileError(
          'Duplicate emission into slot "mixer" of type mixer which accepts at most one value',
          rangeOf(source, 'mixer {}', source.indexOf('mixer {} // 1'))
        )
      ])
    })

    it('should reject buses as sources in bus before their declaration', () => {
      const source = [
        '& mixer {',
        '  & bus { & bus1 }',
        '  & bus1 = bus {}',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Unknown identifier "bus1"'
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
        'Type (instrument + {gain: parameter.db}) has no property named "__proto__"',
        'Module "instruments" has no export named "constructor"',
        'Type (instrument + {gain: parameter.db}) has no property named "constructor"',
        'Module "instruments" has no export named "toString"',
        'Type (instrument + {gain: parameter.db}) has no property named "toString"'
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
        '  & voice {',
        '    bar = 440.hz',
        '    bar = 880.hz',
        '    & ~[lin(0.db, -60.db):100.ms]',
        '    & src.sine(440)',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Identifier "bar" is already defined',
        'Expected type number.hz for argument "frequency", got number'
      ])
    })

    it('should reject empty voice', () => {
      const source = [
        'use "sources" as src',
        '',
        'my_instrument = instrument {',
        '  & voice {}',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Expected at least one emission into slot "envelope" of type curve.db',
        'Expected at least one emission into slot "output" of type source'
      ])
    })

    it('should reject accessing note from another voice', () => {
      const source = [
        'use "sources" as src',
        '',
        'my_instrument = instrument {',
        '  & voice note {',
        '    & ~[lin(0.db, -60.db):100.ms]',
        '    & src.sine(440.hz)',
        '  }',
        '  & voice {',
        '    baz = note',
        '    & ~[lin(0.db, -60.db):100.ms]',
        '    & src.sine(440.hz)',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Unknown identifier "note"'
      ])
    })

    it('should reject reassignment of the note binding', () => {
      const source = [
        'use "sources" as src',
        '',
        'my_instrument = instrument {',
        '  & voice note {',
        '    note = 440.hz',
        '    & ~[lin(0.db, -60.db):100.ms]',
        '    & src.sine(note)',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Identifier "note" is already defined',
        'Expected type number.hz for argument "frequency", got {frequency: number.hz, gate: number.beats, velocity: number}'
      ])
    })

    it('should reject multiple outputs in a voice', () => {
      const source = [
        'use "sources" as src',
        '',
        'my_instrument = instrument {',
        '  & voice {',
        '    & src.sine(440.hz)',
        '    & src.sine(880.hz)',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Duplicate emission into slot "output" of type source which accepts at most one value',
        'Expected at least one emission into slot "envelope" of type curve.db'
      ])
    })

    it('should reject multiple envelopes in a voice', () => {
      const source = [
        'use "sources" as src',
        '',
        'my_instrument = instrument {',
        '  & voice {',
        '    & ~[hold(0.db):100.ms]',
        '    & ~[hold(0.db):200.ms]',
        '    & src.sine(440.hz)',
        '  }',
        '}'
      ].join('\n')

      assertErrors(source, [
        new CompileError(
          'Duplicate emission into slot "envelope" of type curve.db which accepts at most one value',
          rangeOf(source, '~[hold(0.db):200.ms]')
        )
      ])
    })

    it('should reject exposing properties in a voice', () => {
      const source = [
        'use "sources" as src',
        '',
        'my_instrument = instrument {',
        '  & voice {',
        '    @foo = 42',
        '    & ~[lin(0.db, -60.db):100.ms]',
        '    & src.sine(440.hz)',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Cannot expose properties in this context (voice)'
      ])
    })

    it('should reject blocking calls in non-blocking contexts', () => {
      const source = [
        'use "instruments" as *',
        'use "sources" as src',
        '',
        'my_instrument = instrument {',
        '  & voice {',
        '    foo = sample("piano.wav")',
        '    & ~[lin(0.db, -60.db):100.ms]',
        '    & src.sine(440.hz)',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Function "sample" may block and cannot be called from a realtime context'
      ])
    })

    it('should reject blocking expressions in non-blocking contexts', () => {
      const source = [
        'use "sources" as src',
        '',
        'my_instrument = instrument {',
        '  & voice {',
        '    inv_instrument = instrument {}',
        '    inv_mixer = mixer {}',
        '    inv_track = track {}',
        '',
        '    & ~[lin(0.db, -60.db):100.ms]',
        '    & src.sine(440.hz)',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Constructing a value of type instrument may block, but blocking is not allowed in this context',
        'Constructing a value of type mixer may block, but blocking is not allowed in this context',
        'Constructing a value of type track may block, but blocking is not allowed in this context'
      ])
    })

    it('should infer whether a function blocks from its body', () => {
      const source = [
        'use "instruments" as inst',
        'use "sources" as src',
        '',
        'non_blocking_function = () {',
        '  & src.sine(440.hz)',
        '}',
        'blocking_function = () {',
        '  & inst.sample("piano.wav")',
        '}',
        '',
        'synth = instrument {',
        '  & voice {',
        '    foo = non_blocking_function()',
        '    & src.sine(440.hz), ~[hold(0.db):1.beat]',
        '  }',
        '  & voice {',
        '    foo = blocking_function()',
        '    & src.sine(440.hz), ~[hold(0.db):1.beat]',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Function "blocking_function" may block and cannot be called from a realtime context'
      ])
    })

    it('should reject unknown capabilities', () => {
      const source = [
        'f = (p: (): instrument !unknown) { & p() }'
      ].join('\n')

      assertErrorMessages(source, [
        'Unknown capability "unknown"'
      ])
    })

    it('should reject duplicate capabilities', () => {
      const source = [
        'f = (p: (): instrument !may_block !may_block) { & p() }'
      ].join('\n')

      assertErrorMessages(source, [
        'Duplicate capability "may_block"'
      ])
    })

    it('should reject property exposure in functions', () => {
      const source = [
        'f = () {',
        '  & @foo = 42',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Cannot expose properties in a function'
      ])
    })

    it('should reject invalid type expressions', () => {
      const source = [
        'func0 = (p: invalid_type) { & p }',
        'func1 = (p: number.foo) { & p }',
        'func2 = (p: string.hz) { & p }'
      ].join('\n')

      assertErrorMessages(source, [
        'Unknown type "invalid_type"',
        'Unknown type "number.foo"',
        'Unknown type "string.hz"'
      ])
    })

    it('should reject invalid composite types', () => {
      const source = [
        'func0 = (p: number + number.hz) { & p }',
        'func1 = (p: number.db + number.hz) { & p }',
        'func2 = (p: ((a: number): number) + ((b: number): number)) { & p }',
        'func3 = (p: {a: number.hz} + {a: number.db}) { & p }'
      ].join('\n')

      assertErrorMessages(source, [
        'Type conflict: (number) + (number.hz)',
        'Type conflict: (number.db) + (number.hz)',
        'Type conflict: ((a: number): number) + ((b: number): number)',
        'Type conflict: ({a: number.hz}) + ({a: number.db})'
      ])
    })

    it('should enforce ordering in the global scope', () => {
      const source = [
        '& track (my_tempo) {}',
        'my_tempo = 120.bpm'
      ].join('\n')

      assertErrorMessages(source, [
        'Unknown identifier "my_tempo"'
      ])
    })

    it('should enforce ordering within mixer', () => {
      const source = [
        '& mixer {',
        '  & bus (gain: level) {}',
        '  level = -6.db',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Unknown identifier "level"'
      ])
    })

    it('should enforce ordering within instrument definitions', () => {
      const source = [
        'use "sources" as src',
        '',
        'my_instrument = instrument {',
        '  & voice {',
        '    bar = foo',
        '    & ~[lin(0.db, -60.db):100.ms]',
        '    & src.sine(440.hz)',
        '  }',
        '  foo = -6.db',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Unknown identifier "foo"'
      ])
    })

    it('should enforce boolean type for if statements', () => {
      const source = [
        'foo = 42',
        'bar = ""',
        'if foo {}',
        'if bar {}, else {}'
      ].join('\n')

      assertErrorMessages(source, [
        'Condition must be of type boolean, got number',
        'Condition must be of type boolean, got string'
      ])
    })

    it('should reject reassignment of a variable defined before a conditional branch', () => {
      const source = [
        'foo = 42',
        'if true {',
        '  foo = 100',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Identifier "foo" is already defined'
      ])
    })

    it('should reject reassignment of a variable inside a conditional branch', () => {
      const source = [
        'if true {',
        '  foo = 42',
        '  foo = 100',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Identifier "foo" is already defined'
      ])
    })

    it('should reject access to non-definitely assigned variables', () => {
      const source = [
        'if true {',
        '  foo = 42',
        '}',
        '',
        'if true {',
        '  x = 100',
        '}, else {',
        '  y = 200',
        '}',
        '',
        'bar = foo',
        'baz = x + y'
      ].join('\n')

      assertErrorMessages(source, [
        'Identifier "foo" is not definitely assigned',
        'Identifier "x" is not definitely assigned',
        'Identifier "y" is not definitely assigned'
      ])
    })

    it('should reject unchecked access to optional parameters', () => {
      const source = [
        'my_function = (a: number, b?: number) {',
        '  & 42',
        '  foo = a + b',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Identifier "b" is not definitely assigned'
      ])
    })

    it('should reject incompatible types in conditional branches', () => {
      const source = [
        'if true {',
        '  foo = 42',
        '}, else {',
        '  foo = "test"',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Incompatible types for identifier "foo" in conditional branches: number, string'
      ])
    })

    it('should reject conditional emission with minimum less than 1 for required slots', () => {
      const source = [
        'use "sources" as src',
        '',
        'foo = instrument {',
        '  & voice {',
        '    & ~[lin(0.db, -60.db):100.ms]',
        '    if true { & src.sine(440.hz) }',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Expected at least one emission into slot "output" of type source'
      ])
    })

    it('should reject conditional emission with maximum greater than 1 for single-value slots', () => {
      const source = [
        'use "sources" as src',
        '',
        'foo = instrument {',
        '  & voice {',
        '    & ~[lin(0.db, -60.db):100.ms]',
        '    if true {',
        '      & src.sine(100.hz)',
        '      & src.sine(200.hz)',
        '    }, else {',
        '      & src.sine(300.hz)',
        '    }',
        '  }',
        '}'
      ].join('\n')

      assertErrors(source, [
        new CompileError(
          'Duplicate emission into slot "output" of type source which accepts at most one value',
          rangeOf(source, 'src.sine(200.hz)')
        )
      ])
    })

    it('should reject conditional emission when the maximum has already been reached', () => {
      const source = [
        'use "sources" as src',
        '',
        'foo = instrument {',
        '  & voice {',
        '    & ~[lin(0.db, -60.db):100.ms]',
        '    & src.sine(100.hz)',
        '    if true { & src.sine(200.hz) }',
        '  }',
        '}'
      ].join('\n')

      assertErrors(source, [
        new CompileError(
          'Duplicate emission into slot "output" of type source which accepts at most one value',
          rangeOf(source, 'src.sine(200.hz)')
        )
      ])
    })

    it('should reject functions that do not return a value in all conditional branches', () => {
      const source = [
        'my_function = () {',
        '  if true {',
        '    & 42',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Expected at least one emission into slot "return"'
      ])
    })

    it('should reject functions that return more than one value in any conditional branch', () => {
      const source = [
        'my_function = () {',
        '  if true {',
        '    & 42',
        '  }, else {',
        '    & 100',
        '    & 200',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Duplicate emission into slot "return" which accepts at most one value'
      ])
    })

    it('should reject functions that already return a value before a conditional return', () => {
      const source = [
        'my_function = () {',
        '  & 42',
        '  if true {',
        '    & 100',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Duplicate emission into slot "return" which accepts at most one value'
      ])
    })

    it('should reject incompatible function return types in conditional branches', () => {
      const source = [
        'my_function = () {',
        '  if true {',
        '    & 42.bpm',
        '  }, else {',
        '    & 100.hz',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Incompatible types for slot "return" in conditional branches: number.bpm, number.hz'
      ])
    })

    it('should reject access to properties not part of the intersection of conditional branches', () => {
      const source = [
        'my_function = () {',
        '  if true {',
        '    & instrument {',
        '      @foo = 42',
        '      @bar = "hello"',
        '    }',
        '  }, else {',
        '    & instrument {',
        '      @foo = 100',
        '      @baz = 3.db',
        '    }',
        '  }',
        '}',
        '',
        'access_bar = my_function().bar',
        'access_baz = my_function().baz'
      ].join('\n')

      assertErrorMessages(source, [
        'Type (instrument + {foo: number}) has no property named "bar"',
        'Type (instrument + {foo: number}) has no property named "baz"'
      ])
    })

    it('should reject access to conditionally exposed properties', () => {
      const source = [
        'instrument0 = instrument {',
        '  if true {',
        '    @foo = { @bar = 42 @str = "" }',
        '    @x = 100.hz',
        '  }, else {',
        '    @foo = { @bar = 100 @num = 3.db }',
        '    @y = 200.hz',
        '  }',
        '}',
        '',
        'instrument1 = instrument {',
        '  if true {',
        '    @hello = "world"',
        '  }',
        '}',
        '',
        'access_x = instrument0.x',
        'access_y = instrument0.y',
        'access_str = instrument0.foo.str',
        'access_num = instrument0.foo.num',
        '',
        'access_hello = instrument1.hello'
      ].join('\n')

      assertErrorMessages(source, [
        // All branches expose *some* properties, but not the same ones, so the intersection type
        // should include the 'record' facet with only the common property "foo".
        'Type (instrument + {foo: {bar: number}}) has no property named "x"',
        'Type (instrument + {foo: {bar: number}}) has no property named "y"',

        // The properties of "foo" should be intersected as well.
        'Type {bar: number} has no property named "str"',
        'Type {bar: number} has no property named "num"',

        // Only one branch exposes a property, so the intersection type should NOT include the 'record' facet at all.
        'Type instrument has no property named "hello"'
      ])
    })

    it('should reject duplicate property exposure in the same conditional branch', () => {
      const source = [
        'my_record = {',
        '  if true {',
        '    @foo = 42',
        '    @foo = 100',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Identifier "foo" is already defined',
        'Duplicate property "foo"'
      ])
    })

    it('should reject incompatible property types in conditional branches', () => {
      const source = [
        'my_record = {',
        '  if true {',
        '    @foo = 42',
        '  }, else {',
        '    @foo = "test"',
        '  }',
        '}'
      ].join('\n')

      assertErrorMessages(source, [
        'Incompatible types for identifier "foo" in conditional branches: number, string',
        'Incompatible types for property "foo" in conditional branches: number, string'
      ])
    })

    it('should reject invalid equality comparisons', () => {
      const source = [
        'number_string_eq = 42 == "hello"',
        'number_string_neq = 42 != "hello"',

        'string_number_eq = "hello" == 42',
        'string_number_neq = "hello" != 42',

        'boolean_string_eq = true == "hello"',
        'boolean_string_neq = true != "hello"',

        'number_boolean_eq = 42 == true',
        'number_boolean_neq = 42 != true',

        'number_generics_eq = 42 == 10.hz',
        'number_generics_neq = 42 != 10.hz'
      ].join('\n')

      assertErrorMessages(source, [
        'Incompatible operands for "==": number, string',
        'Incompatible operands for "!=": number, string',

        'Incompatible operands for "==": string, number',
        'Incompatible operands for "!=": string, number',

        'Incompatible operands for "==": boolean, string',
        'Incompatible operands for "!=": boolean, string',

        'Incompatible operands for "==": number, boolean',
        'Incompatible operands for "!=": number, boolean',

        'Incompatible operands for "==": number, number.hz',
        'Incompatible operands for "!=": number, number.hz'
      ])
    })

    it('should reject equality comparisons between records', () => {
      const source = [
        'record_record_eq = {} == {}',
        'record_record_neq = {} != {}',

        'empty = {}',
        'empty_self_eq = empty == empty',
        'empty_self_neq = empty != empty',
        '',
        'non_empty = { @foo = 42 }',
        'non_empty_self_eq = non_empty == non_empty',
        'non_empty_self_neq = non_empty != non_empty'
      ].join('\n')

      assertErrorMessages(source, [
        'Incompatible operands for "==": {}, {}',
        'Incompatible operands for "!=": {}, {}',
        'Incompatible operands for "==": {}, {}',
        'Incompatible operands for "!=": {}, {}',
        'Incompatible operands for "==": {foo: number}, {foo: number}',
        'Incompatible operands for "!=": {foo: number}, {foo: number}'
      ])
    })
  })
})
