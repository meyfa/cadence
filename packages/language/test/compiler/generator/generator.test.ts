import type { Program } from '@core'
import { convertPitchToMidi, getMidiFrequency } from '@core'
import { numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { check } from '../../../src/compiler/checker/checker.js'
import { generate } from '../../../src/compiler/generator/generator.js'
import { lex } from '../../../src/lexer/lexer.js'
import { parse } from '../../../src/parser/parser.js'
import { assertResultComplete } from '../../test-utils.js'

const DEFAULT_TEMPO = numeric('bpm', 120)

function generateSource (source: string) {
  const tokens = lex(source)
  assertResultComplete(tokens)

  const ast = parse(tokens.value)
  assertResultComplete(ast)

  const checked = check(ast.value)
  assertResultComplete(checked)

  return generate(checked.value, {
    tempo: {
      default: DEFAULT_TEMPO.value,
      minimum: 1,
      maximum: 300
    },
    beatsPerBar: 4
  })
}

describe('compiler/generator/generator.ts', () => {
  it('should produce a correct empty program', () => {
    const result = generateSource('')
    assert.deepStrictEqual(result, {
      beatsPerBar: 4,
      instruments: new Map(),
      automations: new Map(),
      assets: new Map(),
      track: {
        tempo: numeric('bpm', 120),
        parts: []
      },
      mixer: {
        buses: [],
        routings: []
      }
    } satisfies Program)
  })

  it('should set track tempo from AST', () => {
    const result = generateSource('track (tempo: 140.bpm) {}')
    assert.deepStrictEqual(result.track.tempo, numeric('bpm', 140))
  })

  it('should clamp track tempo to maximum', () => {
    const result = generateSource('track (tempo: 400.bpm) {}')
    assert.deepStrictEqual(result.track.tempo, numeric('bpm', 300))
  })

  it('should support tempo from a variable', () => {
    const source = [
      'foo = 90.bpm',
      'bar = foo * 2',
      'track (tempo: bar) {}'
    ].join('\n')

    const result = generateSource(source)
    assert.deepStrictEqual(result.track.tempo, numeric('bpm', 180))
  })

  it('should use tempo variable from outer scope', () => {
    const source = [
      'my_tempo = 90.bpm',
      'track (tempo: my_tempo) {',
      '  my_tempo = 150.bpm',
      '}'
    ].join('\n')

    const result = generateSource(source)
    assert.deepStrictEqual(result.track.tempo, numeric('bpm', 90))
  })

  it('should support imported names', () => {
    const source = [
      'use "instruments" as *',
      'kick = sample("kick.wav")'
    ].join('\n')

    const result = generateSource(source)
    assert.deepStrictEqual(result.instruments.size, 1)

    const [asset] = result.assets.values()
    assert.strictEqual(asset.url, 'kick.wav')

    const [instrument] = result.instruments.values()
    const voices = instrument.trigger({ velocity: numeric(undefined, 1) }, DEFAULT_TEMPO)
    assert.strictEqual(voices.length, 1)
    assert.strictEqual(voices[0].source.type, 'sample')
    assert.strictEqual(voices[0].source.assetId, asset.id)
  })

  it('should support import aliases', () => {
    const source = [
      'use "instruments" as inst',
      'kick = inst.sample("kick.wav")'
    ].join('\n')

    const result = generateSource(source)
    assert.deepStrictEqual(result.instruments.size, 1)

    const [asset] = result.assets.values()
    assert.strictEqual(asset.url, 'kick.wav')

    const [instrument] = result.instruments.values()
    const voices = instrument.trigger({ velocity: numeric(undefined, 1) }, DEFAULT_TEMPO)
    assert.strictEqual(voices.length, 1)
    assert.strictEqual(voices[0].source.type, 'sample')
    assert.strictEqual(voices[0].source.assetId, asset.id)
  })

  it('should support shadowing of imported names', () => {
    const source = [
      'use "effects" as *',
      'gain = 123.bpm',
      'track (tempo: gain) {}'
    ].join('\n')

    const result = generateSource(source)
    assert.deepStrictEqual(result.track.tempo, numeric('bpm', 123))
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

    const result = generateSource(source)
    assert.deepStrictEqual(result.track.parts[0].name, 'foo')
    assert.deepStrictEqual(result.mixer.buses[0].name, 'foo')
  })

  it('should clamp negative part lengths to 0', () => {
    const result = generateSource('track { part intro (-4.bars) {} }')
    assert.deepStrictEqual(result.track.parts[0].length, numeric('beats', 0))
  })

  it('should support part lengths from variables', () => {
    const source = [
      'root_scope = 42.beats',
      'shadowed = 100.beats',
      'track {',
      '  track_scope = root_scope + 1.beats',
      '  shadowed = 200.beats',
      '  part part0 (length: root_scope) {}',
      '  part part1 (length: track_scope) {}',
      '  part part2 (length: shadowed) {}',
      '}'
    ].join('\n')

    const result = generateSource(source)
    assert.deepStrictEqual(result.track.parts[0].length, numeric('beats', 42))
    assert.deepStrictEqual(result.track.parts[1].length, numeric('beats', 43))
    assert.deepStrictEqual(result.track.parts[2].length, numeric('beats', 200))
  })

  it('should support units: beat, beats, bar, bars', () => {
    const source = [
      'track {',
      '  part part0 (length: 1.beat) {}',
      '  part part1 (length: 2.beats) {}',
      '  part part2 (length: 1.bar) {}',
      '  part part3 (length: 2.bars) {}',
      '}'
    ].join('\n')

    const result = generateSource(source)
    assert.deepStrictEqual(result.track.parts[0].length, numeric('beats', 1))
    assert.deepStrictEqual(result.track.parts[1].length, numeric('beats', 2))
    assert.deepStrictEqual(result.track.parts[2].length, numeric('beats', 4))
    assert.deepStrictEqual(result.track.parts[3].length, numeric('beats', 8))
  })

  it('should resolve variables in track scope', () => {
    const source = [
      'root_scope = 8.beats',
      'shadowed = 100.beats',
      'track {',
      '  track_scope = root_scope + 1.beats',
      '  shadowed = 200.beats',
      '  part part0 (length: root_scope) {}',
      '  part part1 (length: track_scope) {}',
      '  part part2 (length: shadowed) {}',
      '}'
    ].join('\n')

    const result = generateSource(source)
    assert.deepStrictEqual(result.track.parts[0].length, numeric('beats', 8))
    assert.deepStrictEqual(result.track.parts[1].length, numeric('beats', 9))
    assert.deepStrictEqual(result.track.parts[2].length, numeric('beats', 200))
  })

  it('should resolve variables in mixer scope', () => {
    const source = [
      'root_scope = -42.db',
      'shadowed = -100.db',
      'mixer {',
      '  mixer_scope = root_scope + 1.db',
      '  shadowed = -200.db',
      '  bus bus0 (gain: root_scope) {}',
      '  bus bus1 (gain: mixer_scope) {}',
      '  bus bus2 (gain: shadowed) {}',
      '}'
    ].join('\n')

    const result = generateSource(source)
    assert.deepStrictEqual(result.mixer.buses[0].gain.initial, numeric('db', -42))
    assert.deepStrictEqual(result.mixer.buses[1].gain.initial, numeric('db', -41))
    assert.deepStrictEqual(result.mixer.buses[2].gain.initial, numeric('db', -200))
  })

  it('should resolve variables in part scope', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      'track {',
      '  part intro (4.bars) {',
      '    my_pattern = [C4 D4]',
      '    synth << my_pattern',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)
    const routing = result.track.parts[0].routings[0]
    assert.strictEqual(routing.source.type, 'pattern')
    assert.deepStrictEqual([...routing.source.value.evaluate()], [
      { time: numeric('beats', 0), pitch: 'C4', gate: numeric('beats', 1), velocity: numeric(undefined, 1) },
      { time: numeric('beats', 1), pitch: 'D4', gate: numeric('beats', 1), velocity: numeric(undefined, 1) }
    ])
  })

  it('should resolve variables in bus scope', () => {
    const source = [
      'use "effects" as *',
      'mixer {',
      '  bus main {',
      '    my_gain = -20.db',
      '    effect gain(my_gain)',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)
    const effect = result.mixer.buses[0].effects[0]
    assert.strictEqual(effect.type, 'gain')
    assert.deepStrictEqual(effect.gain.initial, numeric('db', -20))
  })

  it('should generate instrument routings for patterns', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      'track {',
      '  part (4.bars) {',
      '    synth << [C4(0.5):2 D4(1, vel: 0.75) -]',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    const routing = result.track.parts[0].routings[0]
    assert.strictEqual(routing.source.type, 'pattern')
    assert.deepStrictEqual([...routing.source.value.evaluate()], [
      { time: numeric('beats', 0), pitch: 'C4', gate: numeric('beats', 0.5), velocity: numeric(undefined, 1) },
      { time: numeric('beats', 2), pitch: 'D4', gate: numeric('beats', 1), velocity: numeric(undefined, 0.75) }
    ])
  })

  it('should clamp step velocity to [0, 1]', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      'track {',
      '  part (4.bars) {',
      '    synth << [C4(vel: 1.5):2 D4(vel: -0.5)]',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    const routing = result.track.parts[0].routings[0]
    assert.strictEqual(routing.source.type, 'pattern')
    assert.deepStrictEqual([...routing.source.value.evaluate()], [
      { time: numeric('beats', 0), pitch: 'C4', gate: numeric('beats', 2), velocity: numeric(undefined, 1) },
      { time: numeric('beats', 2), pitch: 'D4', gate: numeric('beats', 1), velocity: numeric(undefined, 0) }
    ])
  })

  it('should generate automation points for a lin curve', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      'track (120.bpm) {',
      '  part intro (4.bars) {',
      '    automate synth.gain as ~[lin((-60).db, 0.db):2.bars]',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const [automation] = result.automations.values()

    assert.deepStrictEqual(automation.points, [
      { time: numeric('s', 0), value: numeric('db', -60), shape: 'step' },
      { time: numeric('s', 4), value: numeric('db', 0), shape: 'linear' }
    ])
  })

  it('should handle multiple curve segments', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      'track (120.bpm) {',
      '  part intro (4.bars) {',
      '    automate synth.gain as ~[lin(-60.db, -30.db):2.bars lin(-30.db, 0.db):1.bar]',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const [automation] = result.automations.values()

    assert.deepStrictEqual(automation.points, [
      { time: numeric('s', 0), value: numeric('db', -60), shape: 'step' },
      { time: numeric('s', 4), value: numeric('db', -30), shape: 'linear' },
      { time: numeric('s', 6), value: numeric('db', 0), shape: 'linear' }
    ])
  })

  it('should clip curve lengths to the part length', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      'track (120.bpm) {',
      '  part intro (8.bars) {',
      '    automate synth.gain as ~[hold(-60.db):5.bars lin(-60.db, 0.db):6.bars hold:2.bars]',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const [automation] = result.automations.values()

    assert.deepStrictEqual(automation.points, [
      { time: numeric('s', 0), value: numeric('db', -60), shape: 'step' },
      { time: numeric('s', 10), value: numeric('db', -60), shape: 'step' },
      { time: numeric('s', 16), value: numeric('db', -30), shape: 'linear' }
    ])
  })

  it('should use the previous segment end when lin start is omitted', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      'track (120.bpm) {',
      '  part intro (8.bars) {',
      '    automate synth.gain as ~[hold((-60).db):6.bars lin(0.db):2.bars]',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const [automation] = result.automations.values()

    assert.deepStrictEqual(automation.points, [
      { time: numeric('s', 0), value: numeric('db', -60), shape: 'step' },
      { time: numeric('s', 12), value: numeric('db', -60), shape: 'step' },
      { time: numeric('s', 16), value: numeric('db', 0), shape: 'linear' }
    ])
  })

  it('should use the previous segment end when hold value is omitted', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      'track (120.bpm) {',
      '  part intro (8.bars) {',
      '    automate synth.gain as ~[lin((-60).db, (-30).db):6.bars hold:2.bars]',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const [automation] = result.automations.values()

    assert.deepStrictEqual(automation.points, [
      { time: numeric('s', 0), value: numeric('db', -60), shape: 'step' },
      { time: numeric('s', 12), value: numeric('db', -30), shape: 'linear' },
      { time: numeric('s', 16), value: numeric('db', -30), shape: 'step' }
    ])
  })

  it('should clamp non-positive curve segment lengths and skip zero-length segments', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      'track (120.bpm) {',
      '  part intro (4.bars) {',
      '    automate synth.gain as ~[hold((-60).db):(-2.beats) lin((-60).db, (-30).db):0.s lin((-30).db, 0.db):4.bars]',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const [automation] = result.automations.values()

    assert.deepStrictEqual(automation.points, [
      { time: numeric('s', 0), value: numeric('db', -30), shape: 'step' },
      { time: numeric('s', 8), value: numeric('db', 0), shape: 'linear' }
    ])
  })

  it('should combine automations from multiple parts', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      'track (120.bpm) {',
      '  part intro (8.beats) {',
      '    automate synth.gain as ~[lin(-60.db, 0.db):8.beats]',
      '  }',
      '  part outro (8.beats) {',
      '    automate synth.gain as ~[lin(-15.db, -30.db):8.beats]',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const [automation] = result.automations.values()

    assert.deepStrictEqual(automation.points, [
      { time: numeric('s', 0), value: numeric('db', -60), shape: 'step' },
      { time: numeric('s', 4), value: numeric('db', 0), shape: 'linear' },
      { time: numeric('s', 4), value: numeric('db', -15), shape: 'step' },
      { time: numeric('s', 8), value: numeric('db', -30), shape: 'linear' }
    ])
  })

  it('should let later automations override earlier ones in the same part', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      'track (120.bpm) {',
      '  part intro (8.beats) {',
      '    automate synth.gain as ~[lin(-60.db, 0.db):8.beats]',
      '    automate synth.gain as ~[hold(-15.db):8.beats]',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const [automation] = result.automations.values()

    assert.deepStrictEqual(automation.points, [
      { time: numeric('s', 0), value: numeric('db', -15), shape: 'step' },
      { time: numeric('s', 4), value: numeric('db', -15), shape: 'step' }
    ])
  })

  it('should resume earlier automations after a later overlap ends', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      'track (120.bpm) {',
      '  part intro (8.beats) {',
      '    automate synth.gain as ~[lin(-60.db, 0.db):8.beats]',
      '    automate synth.gain as ~[hold(-15.db):4.beats]',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const [automation] = result.automations.values()

    assert.deepStrictEqual(automation.points, [
      { time: numeric('s', 0), value: numeric('db', -15), shape: 'step' },
      { time: numeric('s', 2), value: numeric('db', -30), shape: 'step' },
      { time: numeric('s', 4), value: numeric('db', 0), shape: 'linear' }
    ])
  })

  it('should automate bus gain via explicit namespace', () => {
    const source = [
      'mixer {',
      '  bus main {}',
      '}',
      'track (120.bpm) {',
      '  part intro (4.bars) {',
      '    automate bus.main.gain as ~[lin((-20).db, 0.db):4.bars]',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    const automation = result.automations.get(result.mixer.buses[0].gain.id)
    assert.ok(automation != null)
    assert.deepStrictEqual(automation.points, [
      { time: numeric('s', 0), value: numeric('db', -20), shape: 'step' },
      { time: numeric('s', 8), value: numeric('db', 0), shape: 'linear' }
    ])
  })

  it('should automate bus effect parameters via explicit namespace', () => {
    const source = [
      'use "effects" as fx',
      'mixer {',
      '  bus main {',
      '    effect lp = fx.lowpass(123.hz)',
      '  }',
      '}',
      'track (120.bpm) {',
      '  part intro (4.bars) {',
      '    automate bus.main.lp.frequency as ~[lin(100.hz, 4000.hz):4.bars]',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    const effect = result.mixer.buses[0].effects[0]
    assert.strictEqual(effect.type, 'lowpass')
    assert.deepStrictEqual(effect.frequency.initial, numeric('hz', 123))

    const automation = result.automations.get(effect.frequency.id)
    assert.ok(automation != null)
    assert.deepStrictEqual(automation.points, [
      { time: numeric('s', 0), value: numeric('hz', 100), shape: 'step' },
      { time: numeric('s', 8), value: numeric('hz', 4000), shape: 'linear' }
    ])
  })

  it('should automate effect parameters', () => {
    const source = [
      'use "effects" as fx',
      'lp = fx.lowpass(200.hz)',
      'track (120.bpm) {',
      '  part intro (4.bars) {',
      '    automate lp.frequency as ~[lin(500.hz, 1000.hz):4.bars]',
      '  }',
      '}',
      'mixer {',
      '  bus main {',
      '    effect lp',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    const effect = result.mixer.buses[0].effects[0]
    assert.strictEqual(effect.type, 'lowpass')
    assert.deepStrictEqual(effect.frequency.initial, numeric('hz', 200))

    const automation = result.automations.get(effect.frequency.id)
    assert.ok(automation != null)
    assert.deepStrictEqual(automation.points, [
      { time: numeric('s', 0), value: numeric('hz', 500), shape: 'step' },
      { time: numeric('s', 8), value: numeric('hz', 1000), shape: 'linear' }
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
      'mixer {}',
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
      'mixer {',
      '  bus bus0 {}',
      '  bus bus1 { bus0 }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    const bus0 = result.mixer.buses.find((bus) => bus.name === 'bus0')
    assert.ok(bus0 != null)

    const bus1 = result.mixer.buses.find((bus) => bus.name === 'bus1')
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
      'mixer {',
      '  bus bus0 {',
      '    effect fx.delay(mix: 0.25, time: 1.5.s, feedback: 0.4)',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    const effect = result.mixer.buses[0].effects[0]
    assert.strictEqual(effect.type, 'delay')

    assert.deepStrictEqual(effect, {
      type: 'delay',
      mix: numeric(undefined, 0.25),
      time: numeric('s', 1.5),
      feedback: {
        id: effect.feedback.id,
        initial: numeric(undefined, 0.4)
      },
      wet: numeric('db', 0)
    })
  })

  it('should preserve beats for reverb decay', () => {
    const source = [
      'use "effects" as fx',
      'mixer {',
      '  bus bus0 {',
      '    effect fx.reverb(mix: 0.25, decay: 2.beats)',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)
    assert.deepStrictEqual(result.mixer.buses[0].effects[0], {
      type: 'reverb',
      mix: numeric(undefined, 0.25),
      decay: numeric('beats', 2),
      wet: numeric('db', 0)
    })
  })

  it('should generate silent instruments', () => {
    const source = [
      'my_instrument = instrument {',
      '  foo = -6.db',
      '  voice {',
      '    bar = 440.hz',
      '  }',
      '  voice note {',
      '    baz = note',
      '    note_frequency = note.frequency',
      '    note_gate = note.gate',
      '    note_velocity = note.velocity',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)
    assert.deepStrictEqual(result.instruments.size, 1)

    const [instrument] = result.instruments.values()
    const voices = instrument.trigger({ velocity: numeric(undefined, 1) }, DEFAULT_TEMPO)
    assert.strictEqual(voices.length, 0)
  })

  it('should generate instruments with voices', () => {
    const source = [
      'use "sources" as src',
      'my_instrument = instrument {',
      '  voice {',
      '    envelope ~[lin(0.db, -60.db):1.beat]',
      '    output src.sine(440.hz)',
      '  }',
      '  voice note {',
      '    envelope ~[lin(0.db, -60.db):1.beat]',
      '    output src.sine(note.frequency)',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)
    assert.deepStrictEqual(result.instruments.size, 1)

    const pitch = 'C5' as const
    const pitchFrequency = getMidiFrequency(convertPitchToMidi(pitch))

    const [instrument] = result.instruments.values()
    const voices = instrument.trigger({ velocity: numeric(undefined, 1), pitch }, DEFAULT_TEMPO)
    assert.strictEqual(voices.length, 2)

    const [voice0, voice1] = voices
    assert.deepStrictEqual(voice0.envelope.points, [
      { time: numeric('s', 0), value: numeric('db', 0), shape: 'step' },
      { time: numeric('s', 0.5), value: numeric('db', -60), shape: 'linear' }
    ])
    assert.strictEqual(voice0.source.type, 'oscillator')
    assert.strictEqual(voice0.source.shape, 'sine')
    assert.deepStrictEqual(voice0.source.frequency, numeric('hz', 440))

    assert.deepStrictEqual(voice1.envelope.points, [
      { time: numeric('s', 0), value: numeric('db', 0), shape: 'step' },
      { time: numeric('s', 0.5), value: numeric('db', -60), shape: 'linear' }
    ])
    assert.strictEqual(voice1.source.type, 'oscillator')
    assert.strictEqual(voice1.source.shape, 'sine')
    assert.deepStrictEqual(voice1.source.frequency, numeric('hz', pitchFrequency))
  })
})
