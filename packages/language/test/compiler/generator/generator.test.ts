import type { Program } from '@meyfa/cadence-core'
import { convertPitchToMidi, getMidiFrequency } from '@meyfa/cadence-core'
import type { Numeric } from '@meyfa/cadence-utility'
import { runtimeNumeric } from '@meyfa/cadence-utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { check } from '../../../src/compiler/checker/checker.ts'
import { generate } from '../../../src/compiler/generator/generator.ts'
import { lex } from '../../../src/lexer/lexer.ts'
import { parse } from '../../../src/parser/parser.ts'
import { assertResultComplete } from '../../test-utils.ts'
import { createFixtureTests } from '../../fixture-utils.ts'

const scalar = (value: number) => value as Numeric<undefined>
const beats = (value: number) => value as Numeric<'beats'>
const seconds = (value: number) => value as Numeric<'s'>
const db = (value: number) => value as Numeric<'db'>
const hz = (value: number) => value as Numeric<'hz'>

const DEFAULT_TEMPO = 120 as Numeric<'bpm'>

function generateSource (source: string, fileName?: string): Program {
  const tokens = lex(source, fileName)
  assertResultComplete(tokens)

  const ast = parse(tokens.value)
  assertResultComplete(ast)

  const checked = check(ast.value)
  assertResultComplete(checked)

  return generate(checked.value, {
    tempo: {
      default: DEFAULT_TEMPO,
      minimum: 1 as Numeric<'bpm'>,
      maximum: 300 as Numeric<'bpm'>
    },
    beatsPerBar: 4
  })
}

describe('compiler/generator/generator.ts', async () => {
  await createFixtureTests({
    component: 'generator',
    compute: (fixture) => generateSource(fixture.source, fixture.name)
  })

  it('should support tempo from a variable', () => {
    const source = [
      'foo = 90.bpm',
      'bar = foo * 2',
      '& track (tempo: bar) {}'
    ].join('\n')

    const result = generateSource(source)
    assert.strictEqual(result.track.tempo, 180)
  })

  it('should use tempo variable from outer scope', () => {
    const source = [
      'my_tempo = 90.bpm',
      '& track (tempo: my_tempo) {',
      '  my_tempo = 150.bpm',
      '}'
    ].join('\n')

    const result = generateSource(source)
    assert.strictEqual(result.track.tempo, 90)
  })

  it('should handle property exposure', () => {
    const source = [
      'm = mixer { @bit = 1 }',
      'b = bus { @bit = 2 }',
      't = track { @bit = 4 }',
      'p = part (1.bar) { @bit = 8 }',
      '',
      'mask = m.bit + b.bit + t.bit + p.bit',
      '',
      '& track (tempo: mask.bpm) {}'
    ].join('\n')

    const result = generateSource(source)
    assert.strictEqual(result.track.tempo, 15)
  })

  it('should support property exposure in record values', () => {
    const source = [
      'my_record = { @foo = 123 }',
      '& track (tempo: my_record.foo.bpm) {}'
    ].join('\n')

    const result = generateSource(source)
    assert.strictEqual(result.track.tempo, 123)
  })

  it('should support part lengths from variables', () => {
    const source = [
      'root_scope = 42.beats',
      'shadowed = 100.beats',
      '& track {',
      '  track_scope = root_scope + 1.beats',
      '  shadowed = 200.beats',
      '  & part (length: root_scope) {}',
      '  & part (length: track_scope) {}',
      '  & part (length: shadowed) {}',
      '}'
    ].join('\n')

    const result = generateSource(source)
    assert.strictEqual(result.track.parts[0].length, 42)
    assert.strictEqual(result.track.parts[1].length, 43)
    assert.strictEqual(result.track.parts[2].length, 200)
  })

  it('should support units: beat, beats, bar, bars', () => {
    const source = [
      '& track {',
      '  & part (length: 1.beat) {}',
      '  & part (length: 2.beats) {}',
      '  & part (length: 1.bar) {}',
      '  & part (length: 2.bars) {}',
      '}'
    ].join('\n')

    const result = generateSource(source)
    assert.strictEqual(result.track.parts[0].length, 1)
    assert.strictEqual(result.track.parts[1].length, 2)
    assert.strictEqual(result.track.parts[2].length, 4)
    assert.strictEqual(result.track.parts[3].length, 8)
  })

  it('should resolve variables in track scope', () => {
    const source = [
      'root_scope = 8.beats',
      'shadowed = 100.beats',
      '& track {',
      '  track_scope = root_scope + 1.beats',
      '  shadowed = 200.beats',
      '  & part (length: root_scope) {}',
      '  & part (length: track_scope) {}',
      '  & part (length: shadowed) {}',
      '}'
    ].join('\n')

    const result = generateSource(source)
    assert.strictEqual(result.track.parts[0].length, 8)
    assert.strictEqual(result.track.parts[1].length, 9)
    assert.strictEqual(result.track.parts[2].length, 200)
  })

  it('should resolve variables in mixer scope', () => {
    const source = [
      'root_scope = -42.db',
      'shadowed = -100.db',
      '& mixer {',
      '  mixer_scope = root_scope + 1.db',
      '  shadowed = -200.db',
      '  & bus (gain: root_scope) {}',
      '  & bus (gain: mixer_scope) {}',
      '  & bus (gain: shadowed) {}',
      '}'
    ].join('\n')

    const result = generateSource(source)
    assert.strictEqual(result.mixer.buses[0].gain.initial, db(-42))
    assert.strictEqual(result.mixer.buses[1].gain.initial, db(-41))
    assert.strictEqual(result.mixer.buses[2].gain.initial, db(-200))
  })

  it('should resolve variables in part scope', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      '& track {',
      '  & part (4.bars) {',
      '    my_pattern = [C4 D4]',
      '    & play(synth, my_pattern)',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)
    const routing = result.track.parts[0].routings[0]
    assert.strictEqual(routing.source.type, 'pattern')
    assert.deepStrictEqual([...routing.source.value.evaluate()], [
      { time: beats(0), pitch: 'C4', gate: beats(1), velocity: scalar(1) },
      { time: beats(1), pitch: 'D4', gate: beats(1), velocity: scalar(1) }
    ])
  })

  it('should resolve variables in bus scope', () => {
    const source = [
      'use "effects" as *',
      '& mixer {',
      '  & bus {',
      '    my_gain = -20.db',
      '    & gain(my_gain)',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)
    const effect = result.mixer.buses[0].effects[0]
    assert.strictEqual(effect.type, 'gain')
    assert.strictEqual(effect.gain.initial, db(-20))
  })

  it('should support simple functions', () => {
    const source = [
      'get_tempo = () { & 123.bpm }',
      '& track (tempo: get_tempo()) {}'
    ].join('\n')

    const result = generateSource(source)
    assert.strictEqual(result.track.tempo, 123)
  })

  it('should generate instrument routings for patterns', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      '& track {',
      '  & part (4.bars) {',
      '    & play(synth, [C4(0.5):2 D4(1, vel: 0.75) -])',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    const routing = result.track.parts[0].routings[0]
    assert.strictEqual(routing.source.type, 'pattern')
    assert.deepStrictEqual([...routing.source.value.evaluate()], [
      { time: beats(0), pitch: 'C4', gate: beats(0.5), velocity: scalar(1) },
      { time: beats(2), pitch: 'D4', gate: beats(1), velocity: scalar(0.75) }
    ])
  })

  it('should clamp step velocity to [0, 1]', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      '& track {',
      '  & part (4.bars) {',
      '    & play(synth, [C4(vel: 1.5):2 D4(vel: -0.5)])',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    const routing = result.track.parts[0].routings[0]
    assert.strictEqual(routing.source.type, 'pattern')
    assert.deepStrictEqual([...routing.source.value.evaluate()], [
      { time: beats(0), pitch: 'C4', gate: beats(2), velocity: scalar(1) },
      { time: beats(2), pitch: 'D4', gate: beats(1), velocity: scalar(0) }
    ])
  })

  it('should support renamed automate function', () => {
    const source = [
      'use "effects" as fx',
      '',
      'gain_effect = fx.gain(0.db)',
      'my_automate = automate',
      '',
      '& track {',
      '  & part (4.bars) {',
      '    & my_automate(gain_effect.gain, ~[hold(-6.db):2.bars])',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)
    assert.strictEqual(result.automations.size, 1)

    const [automation] = result.automations.values()
    assert.deepStrictEqual(automation.points, [
      { time: seconds(0), value: db(-6), shape: 'step' },
      { time: seconds(4), value: db(-6), shape: 'step' }
    ])
  })

  it('should generate automation points for a lin curve', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      '& track (120.bpm) {',
      '  & part (4.bars) {',
      '    & automate(synth.gain, ~[lin((-60).db, 0.db):2.bars])',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const [automation] = result.automations.values()

    assert.deepStrictEqual(automation.points, [
      { time: seconds(0), value: db(-60), shape: 'step' },
      { time: seconds(4), value: db(0), shape: 'linear' }
    ])
  })

  it('should handle multiple curve segments', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      '& track (120.bpm) {',
      '  & part (4.bars) {',
      '    & automate(synth.gain, ~[lin(-60.db, -30.db):2.bars lin(-30.db, 0.db):1.bar])',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const [automation] = result.automations.values()

    assert.deepStrictEqual(automation.points, [
      { time: seconds(0), value: db(-60), shape: 'step' },
      { time: seconds(4), value: db(-30), shape: 'linear' },
      { time: seconds(6), value: db(0), shape: 'linear' }
    ])
  })

  it('should interpolate curves and inherit their final segment value', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      'previous = ~[lin(-60.db, -30.db):1.bar lin(-30.db, -15.db):1.bar]',
      '& track (120.bpm) {',
      '  & part (4.bars) {',
      '    & automate(synth.gain, ~[{previous} lin(0.db):1.bar])',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const [automation] = result.automations.values()

    assert.deepStrictEqual(automation.points, [
      { time: seconds(0), value: db(-60), shape: 'step' },
      { time: seconds(2), value: db(-30), shape: 'linear' },
      { time: seconds(4), value: db(-15), shape: 'linear' },
      { time: seconds(6), value: db(0), shape: 'linear' }
    ])
  })

  it('should clip curve lengths to the part length', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      '& track (120.bpm) {',
      '  & part (8.bars) {',
      '    & automate(synth.gain, ~[hold(-60.db):5.bars lin(-60.db, 0.db):6.bars hold:2.bars])',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const [automation] = result.automations.values()

    assert.deepStrictEqual(automation.points, [
      { time: seconds(0), value: db(-60), shape: 'step' },
      { time: seconds(10), value: db(-60), shape: 'step' },
      { time: seconds(16), value: db(-30), shape: 'linear' }
    ])
  })

  it('should use the previous segment end when lin start is omitted', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      '& track (120.bpm) {',
      '  & part (8.bars) {',
      '    & automate(synth.gain, ~[hold((-60).db):6.bars lin(0.db):2.bars])',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const [automation] = result.automations.values()

    assert.deepStrictEqual(automation.points, [
      { time: seconds(0), value: db(-60), shape: 'step' },
      { time: seconds(12), value: db(-60), shape: 'step' },
      { time: seconds(16), value: db(0), shape: 'linear' }
    ])
  })

  it('should use the previous segment end when hold value is omitted', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      '& track (120.bpm) {',
      '  & part (8.bars) {',
      '    & automate(synth.gain, ~[lin((-60).db, (-30).db):6.bars hold:2.bars])',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const [automation] = result.automations.values()

    assert.deepStrictEqual(automation.points, [
      { time: seconds(0), value: db(-60), shape: 'step' },
      { time: seconds(12), value: db(-30), shape: 'linear' },
      { time: seconds(16), value: db(-30), shape: 'step' }
    ])
  })

  it('should clamp non-positive curve segment lengths and skip zero-length segments', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      '& track (120.bpm) {',
      '  & part (4.bars) {',
      '    & automate(synth.gain, ~[hold((-60).db):(-2.beats) lin((-60).db, (-30).db):0.s lin((-30).db, 0.db):4.bars])',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const [automation] = result.automations.values()

    assert.deepStrictEqual(automation.points, [
      { time: seconds(0), value: db(-30), shape: 'step' },
      { time: seconds(8), value: db(0), shape: 'linear' }
    ])
  })

  it('should combine automations from multiple parts', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      '& track (120.bpm) {',
      '  & part (8.beats) {',
      '    & automate(synth.gain, ~[lin(-60.db, 0.db):8.beats])',
      '  }',
      '  & part (8.beats) {',
      '    & automate(synth.gain, ~[lin(-15.db, -30.db):8.beats])',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const [automation] = result.automations.values()

    assert.deepStrictEqual(automation.points, [
      { time: seconds(0), value: db(-60), shape: 'step' },
      { time: seconds(4), value: db(0), shape: 'linear' },
      { time: seconds(4), value: db(-15), shape: 'step' },
      { time: seconds(8), value: db(-30), shape: 'linear' }
    ])
  })

  it('should let later automations override earlier ones in the same part', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      '& track (120.bpm) {',
      '  & part (8.beats) {',
      '    & automate(synth.gain, ~[lin(-60.db, 0.db):8.beats])',
      '    & automate(synth.gain, ~[hold(-15.db):8.beats])',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const [automation] = result.automations.values()

    assert.deepStrictEqual(automation.points, [
      { time: seconds(0), value: db(-15), shape: 'step' },
      { time: seconds(4), value: db(-15), shape: 'step' }
    ])
  })

  it('should resume earlier automations after a later overlap ends', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      '& track (120.bpm) {',
      '  & part (8.beats) {',
      '    & automate(synth.gain, ~[lin(-60.db, 0.db):8.beats])',
      '    & automate(synth.gain, ~[hold(-15.db):4.beats])',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const [automation] = result.automations.values()

    assert.deepStrictEqual(automation.points, [
      { time: seconds(0), value: db(-15), shape: 'step' },
      { time: seconds(2), value: db(-30), shape: 'step' },
      { time: seconds(4), value: db(0), shape: 'linear' }
    ])
  })

  it('should automate bus gain', () => {
    const source = [
      '& m = mixer {',
      '  & @test_bus = bus {}',
      '}',
      '& track (120.bpm) {',
      '  & part (4.bars) {',
      '    & automate(m.test_bus.gain, ~[lin((-20).db, 0.db):4.bars])',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    const automation = result.automations.get(result.mixer.buses[0].gain.id)
    assert.ok(automation != null)
    assert.deepStrictEqual(automation.points, [
      { time: seconds(0), value: db(-20), shape: 'step' },
      { time: seconds(8), value: db(0), shape: 'linear' }
    ])
  })

  it('should automate bus effect parameters', () => {
    const source = [
      'use "effects" as fx',
      '& m = mixer {',
      '  & @test_bus = bus {',
      '    & @lp = fx.lowpass(123.hz)',
      '  }',
      '}',
      '& track (120.bpm) {',
      '  & part (4.bars) {',
      '    & automate(m.test_bus.lp.frequency, ~[lin(100.hz, 4000.hz):4.bars])',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    const effect = result.mixer.buses[0].effects[0]
    assert.strictEqual(effect.type, 'lowpass')
    assert.strictEqual(effect.frequency.initial, 123)

    const automation = result.automations.get(effect.frequency.id)
    assert.ok(automation != null)
    assert.deepStrictEqual(automation.points, [
      { time: seconds(0), value: hz(100), shape: 'step' },
      { time: seconds(8), value: hz(4000), shape: 'linear' }
    ])
  })

  it('should automate effect parameters', () => {
    const source = [
      'use "effects" as fx',
      '',
      'lp = fx.lowpass(200.hz)',
      '',
      '& track (120.bpm) {',
      '  & part (4.bars) {',
      '    & automate(lp.frequency, ~[lin(500.hz, 1000.hz):4.bars])',
      '  }',
      '}',
      '& mixer {',
      '  & bus {',
      '    & lp',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    const effect = result.mixer.buses[0].effects[0]
    assert.strictEqual(effect.type, 'lowpass')
    assert.strictEqual(effect.frequency.initial, 200)

    const automation = result.automations.get(effect.frequency.id)
    assert.ok(automation != null)
    assert.deepStrictEqual(automation.points, [
      { time: seconds(0), value: hz(500), shape: 'step' },
      { time: seconds(8), value: hz(1000), shape: 'linear' }
    ])
  })

  it('should route instruments into the output when no mixer is present', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      ''
    ].join('\n')

    const result = generateSource(source)

    const [instrument] = result.instruments.values()

    assert.deepStrictEqual(result.mixer.routings, [
      {
        implicit: true,
        destination: { type: 'output' },
        source: { type: 'instrument', id: instrument.id }
      }
    ])
  })

  it('should route instruments into the output when they are declared after the mixer', () => {
    const source = [
      'use "instruments" as *',
      '& mixer {}',
      'synth = sample("synth.wav")'
    ].join('\n')

    const result = generateSource(source)

    const [instrument] = result.instruments.values()

    assert.deepStrictEqual(result.mixer.routings, [
      {
        implicit: true,
        destination: { type: 'output' },
        source: { type: 'instrument', id: instrument.id }
      }
    ])
  })

  it('should support buses as sources in mixer', () => {
    const source = [
      '& mixer {',
      '  & bus0 = bus ("Bus 0") {}',
      '  & bus ("Bus 1") { & bus0 }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    const bus0 = result.mixer.buses.find((bus) => bus.label === 'Bus 0')
    assert.ok(bus0 != null)

    const bus1 = result.mixer.buses.find((bus) => bus.label === 'Bus 1')
    assert.ok(bus1 != null)

    assert.deepStrictEqual(result.mixer.routings, [
      {
        implicit: false,
        destination: { type: 'bus', id: bus1.id },
        source: { type: 'bus', id: bus0.id }
      },
      {
        implicit: true,
        destination: { type: 'output' },
        source: { type: 'bus', id: bus1.id }
      }
    ])
  })

  it('should preserve seconds for delay effect time', () => {
    const source = [
      'use "effects" as fx',
      '& mixer {',
      '  & bus {',
      '    & fx.delay(mix: 0.25, time: 1.5.s, feedback: 0.4)',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    const effect = result.mixer.buses[0].effects[0]
    assert.strictEqual(effect.type, 'delay')

    assert.deepStrictEqual(effect, {
      type: 'delay',
      mix: scalar(0.25),
      time: runtimeNumeric('s', 1.5),
      feedback: {
        id: effect.feedback.id,
        unit: undefined,
        initial: 0.4
      },
      wet: db(0)
    })
  })

  it('should preserve beats for reverb decay', () => {
    const source = [
      'use "effects" as fx',
      '& mixer {',
      '  & bus {',
      '    & fx.reverb(mix: 0.25, decay: 2.beats)',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)
    assert.deepStrictEqual(result.mixer.buses[0].effects[0], {
      type: 'reverb',
      mix: scalar(0.25),
      decay: runtimeNumeric('beats', 2),
      wet: db(0)
    })
  })

  it('should generate instrument without voices', () => {
    const source = [
      'my_instrument = instrument {',
      '  foo = -6.db',
      '}'
    ].join('\n')

    const result = generateSource(source)
    assert.strictEqual(result.instruments.size, 1)

    const [instrument] = result.instruments.values()
    assert.deepStrictEqual(instrument.voices, [])
  })

  it('should generate instruments with voices', () => {
    const source = [
      'use "sources" as src',
      'my_instrument = instrument {',
      '  & voice {',
      '    & ~[lin(0.db, -60.db):1.beat]',
      '    & src.sine(440.hz)',
      '  }',
      '  & voice note {',
      '    n = note',
      '    f = n.frequency',
      '    & ~[lin(0.db, -60.db):1.beat]',
      '    & src.sine(f)',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)
    assert.strictEqual(result.instruments.size, 1)

    const pitch = 'C5' as const
    const pitchFrequency = getMidiFrequency(convertPitchToMidi(pitch))

    const [instrument] = result.instruments.values()
    assert.strictEqual(instrument.voices.length, 2)

    const voice0 = instrument.voices[0].invoke({ velocity: scalar(1), pitch }, DEFAULT_TEMPO)
    const voice1 = instrument.voices[1].invoke({ velocity: scalar(1), pitch }, DEFAULT_TEMPO)

    assert.deepStrictEqual(voice0.envelope.points, [
      { time: seconds(0), value: db(0), shape: 'step' },
      { time: seconds(0.5), value: db(-60), shape: 'linear' }
    ])
    assert.strictEqual(voice0.source.type, 'oscillator')
    assert.strictEqual(voice0.source.shape, 'sine')
    assert.strictEqual(voice0.source.frequency, 440)

    assert.deepStrictEqual(voice1.envelope.points, [
      { time: seconds(0), value: db(0), shape: 'step' },
      { time: seconds(0.5), value: db(-60), shape: 'linear' }
    ])
    assert.strictEqual(voice1.source.type, 'oscillator')
    assert.strictEqual(voice1.source.shape, 'sine')
    assert.strictEqual(voice1.source.frequency, pitchFrequency)
  })

  it('should handle property exposure on instruments', () => {
    const source = [
      'my_instrument = instrument {',
      '  @test_property = 123.bpm',
      '}',
      '& track (tempo: my_instrument.test_property) {}'
    ].join('\n')

    const result = generateSource(source)
    assert.strictEqual(result.track.tempo, 123)
  })

  it('should support conditional function returns', () => {
    const source = [
      'my_function = (condition: boolean) {',
      '  if condition {',
      '    & -6.db',
      '  }, else {',
      '    & -10.db',
      '  }',
      '}',
      '',
      '& mixer {',
      '  & bus (gain: my_function(true)) {}',
      '  & bus (gain: my_function(false)) {}',
      '}'
    ].join('\n')

    const result = generateSource(source)
    assert.strictEqual(result.mixer.buses[0].gain.initial, db(-6))
    assert.strictEqual(result.mixer.buses[1].gain.initial, db(-10))
  })

  it('should support multiple conditional branches', () => {
    type TestCase = readonly [boolean, boolean, number]

    const testCases: readonly TestCase[] = [
      [true, true, 100],
      [true, false, 100],
      [false, true, 200],
      [false, false, 300]
    ]

    for (const [one, two, expected] of testCases) {
      const source = [
        'fn = (one: boolean, two: boolean) {',
        '  if one {',
        '    & 100.bpm',
        '  }, two {',
        '    & 200.bpm',
        '  }, else {',
        '    & 300.bpm',
        '  }',
        '}',
        '',
        `& track (tempo: fn(${one}, ${two})) {}`
      ].join('\n')

      const result = generateSource(source)
      assert.strictEqual(result.track.tempo, expected)
    }
  })
})
