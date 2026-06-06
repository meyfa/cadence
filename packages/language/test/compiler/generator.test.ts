import type { ParameterId, Program } from '@core'
import { numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { generate } from '../../src/compiler/generator.js'
import { lex } from '../../src/lexer/lexer.js'
import { parse } from '../../src/parser/parser.js'
import { assertResultComplete } from '../test-utils.js'

function lexAndParse (source: string) {
  const tokens = lex(source)
  assertResultComplete(tokens)

  const result = parse(tokens.value)
  assertResultComplete(result)

  return result.value
}

function generateSource (source: string) {
  return generate(lexAndParse(source), {
    tempo: {
      default: 120,
      minimum: 1,
      maximum: 300
    },
    beatsPerBar: 4
  })
}

describe('compiler/generator.ts', () => {
  it('should produce a correct empty program', () => {
    const result = generateSource('')
    assert.deepStrictEqual(result, {
      beatsPerBar: 4,
      instruments: new Map(),
      automations: new Map(),
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

  it('should support imported names', () => {
    const source = [
      'use "instruments" as *',
      'kick = sample("kick.wav")'
    ].join('\n')

    const result = generateSource(source)
    assert.deepStrictEqual(result.instruments.size, 1)

    const instrument = result.instruments.get(1 as any)
    assert.strictEqual(instrument?.source.type, 'sample')
  })

  it('should support import aliases', () => {
    const source = [
      'use "instruments" as inst',
      'kick = inst.sample("kick.wav")'
    ].join('\n')

    const result = generateSource(source)
    assert.deepStrictEqual(result.instruments.size, 1)

    const instrument = result.instruments.get(1 as any)
    assert.strictEqual(instrument?.source.type, 'sample')
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

  it('should generate automation points for a lin curve', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      'track {',
      '  part intro (4.bars) {',
      '    automate synth.gain as curve[lin((-60).db, 0.db)]',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const automation = [...result.automations.values()][0]
    assert.deepStrictEqual(automation.points, [
      { time: numeric('beats', 0), value: numeric('db', -60), curve: 'step' },
      { time: numeric('beats', 16), value: numeric('db', 0), curve: 'linear' }
    ])
  })

  it('should allocate equal time to multiple curve segments', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      'track {',
      '  part intro (4.bars) {',
      '    automate synth.gain as curve[lin((-60).db, (-30).db) lin((-30).db, 0.db)]',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const automation = [...result.automations.values()][0]
    assert.deepStrictEqual(automation.points, [
      { time: numeric('beats', 0), value: numeric('db', -60), curve: 'step' },
      { time: numeric('beats', 8), value: numeric('db', -30), curve: 'linear' },
      { time: numeric('beats', 16), value: numeric('db', 0), curve: 'linear' }
    ])
  })

  it('should allocate curve time by segment length weights', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      'track {',
      '  part intro (8.bars) {',
      '    automate synth.gain as curve[hold((-60).db):3 lin((-60).db, 0.db):1]',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const automation = [...result.automations.values()][0]
    assert.deepStrictEqual(automation.points, [
      { time: numeric('beats', 0), value: numeric('db', -60), curve: 'step' },
      { time: numeric('beats', 24), value: numeric('db', -60), curve: 'step' },
      { time: numeric('beats', 32), value: numeric('db', 0), curve: 'linear' }
    ])
  })

  it('should use the previous segment end when lin start is omitted', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      'track {',
      '  part intro (8.bars) {',
      '    automate synth.gain as curve[hold((-60).db):3 lin(0.db):1]',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const automation = [...result.automations.values()][0]
    assert.deepStrictEqual(automation.points, [
      { time: numeric('beats', 0), value: numeric('db', -60), curve: 'step' },
      { time: numeric('beats', 24), value: numeric('db', -60), curve: 'step' },
      { time: numeric('beats', 32), value: numeric('db', 0), curve: 'linear' }
    ])
  })

  it('should use the previous segment end when hold value is omitted', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      'track {',
      '  part intro (8.bars) {',
      '    automate synth.gain as curve[lin((-60).db, (-30).db):3 hold:1]',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const automation = [...result.automations.values()][0]
    assert.deepStrictEqual(automation.points, [
      { time: numeric('beats', 0), value: numeric('db', -60), curve: 'step' },
      { time: numeric('beats', 24), value: numeric('db', -30), curve: 'linear' },
      { time: numeric('beats', 32), value: numeric('db', -30), curve: 'step' }
    ])
  })

  it('should clamp non-positive curve segment lengths and step zero-length segments', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      'track {',
      '  part intro (4.bars) {',
      '    automate synth.gain as curve[hold((-60).db):(-2) lin((-60).db, (-30).db):0 lin((-30).db, 0.db):1]',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)

    assert.strictEqual(result.automations.size, 1)
    const automation = [...result.automations.values()][0]
    assert.deepStrictEqual(automation.points, [
      { time: numeric('beats', 0), value: numeric('db', -60), curve: 'step' },
      { time: numeric('beats', 0), value: numeric('db', -30), curve: 'step' },
      { time: numeric('beats', 16), value: numeric('db', 0), curve: 'linear' }
    ])
  })

  it('should automate bus gain via explicit namespace', () => {
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

    const result = generateSource(source)

    const busGain = result.mixer.buses[0].gain
    const automation = result.automations.get(busGain.id)
    assert.ok(automation != null)
    assert.deepStrictEqual(automation.points, [
      { time: numeric('beats', 0), value: numeric('db', -20), curve: 'step' },
      { time: numeric('beats', 16), value: numeric('db', 0), curve: 'linear' }
    ])
  })

  it('should automate effect parameters', () => {
    const source = [
      'use "effects" as fx',
      'lp = fx.lowpass(123.hz)',
      'track {',
      '  part intro (4.bars) {',
      '    automate lp.frequency as curve[lin(500.hz, 1000.hz)]',
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
    assert.deepStrictEqual(effect.frequency.initial, numeric('hz', 123))

    const automation = result.automations.get(effect.frequency.id)
    assert.ok(automation != null)
    assert.deepStrictEqual(automation.points, [
      { time: numeric('beats', 0), value: numeric('hz', 500), curve: 'step' },
      { time: numeric('beats', 16), value: numeric('hz', 1000), curve: 'linear' }
    ])
  })

  it('should route instruments into the output when no mixer is present', () => {
    const source = [
      'use "instruments" as *',
      'synth = sample("synth.wav")',
      ''
    ].join('\n')

    const result = generateSource(source)
    assert.deepStrictEqual(result.mixer.routings, [
      {
        implicit: true,
        destination: { type: 'output' },
        source: { type: 'instrument', id: 1 }
      }
    ])
  })

  it('should support buses as sources in mixer', () => {
    const source = [
      'mixer {',
      '  bus bus1 { bus2 }',
      '  bus bus2 {}',
      '}'
    ].join('\n')

    const result = generateSource(source)
    assert.deepStrictEqual(result.mixer.routings, [
      {
        implicit: false,
        destination: { type: 'bus', id: 0 },
        source: { type: 'bus', id: 1 }
      },
      {
        implicit: true,
        destination: { type: 'output' },
        source: { type: 'bus', id: 0 }
      }
    ])
  })

  it('should preserve seconds for delay effect time', () => {
    const source = [
      'use "effects" as fx',
      'mixer {',
      '  bus bus1 {',
      '    effect fx.delay(mix: 0.25, time: 1.5.s, feedback: 0.4)',
      '  }',
      '}'
    ].join('\n')

    const result = generateSource(source)
    assert.deepStrictEqual(result.mixer.buses[0].effects[0], {
      type: 'delay',
      mix: numeric(undefined, 0.25),
      time: numeric('s', 1.5),
      feedback: {
        id: 1 as ParameterId,
        initial: numeric(undefined, 0.4)
      },
      wet: numeric('db', 0)
    })
  })

  it('should preserve beats for reverb decay', () => {
    const source = [
      'use "effects" as fx',
      'mixer {',
      '  bus bus1 {',
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

  describe('instruments.sample', () => {
    it('should allocate instrument and parameter IDs correctly', () => {
      const source = [
        'use "instruments" as *',
        'inst1 = sample(url: "sample1.wav")',
        'inst2 = sample(url: "sample2.wav")'
      ].join('\n')

      const result = generateSource(source)
      assert.deepStrictEqual(result.instruments.size, 2)

      const instrument1 = result.instruments.get(1 as any)
      assert.strictEqual(instrument1?.source.type, 'sample')
      assert.deepStrictEqual(instrument1.source.url, 'sample1.wav')

      const instrument2 = result.instruments.get(2 as any)
      assert.strictEqual(instrument2?.source.type, 'sample')
      assert.deepStrictEqual(instrument2.source.url, 'sample2.wav')

      assert.deepStrictEqual(result.automations.size, 2)
      assert.deepStrictEqual(result.instruments.get(1 as any)?.gain.id, 1 as any)
      assert.deepStrictEqual(result.instruments.get(2 as any)?.gain.id, 2 as any)
      assert.deepStrictEqual(result.automations.get(1 as any)?.parameterId, 1 as any)
      assert.deepStrictEqual(result.automations.get(2 as any)?.parameterId, 2 as any)
    })
  })

  describe('instruments.sine', () => {
    it('should allocate instrument and parameter IDs correctly', () => {
      const source = [
        'use "instruments" as *',
        'inst1 = sine(gain: -6.db)',
        'inst2 = sine(gain: -12.db)'
      ].join('\n')

      const result = generateSource(source)
      assert.deepStrictEqual(result.instruments.size, 2)

      const instrument1 = result.instruments.get(1 as any)
      assert.strictEqual(instrument1?.source.type, 'oscillator')
      assert.strictEqual(instrument1.source.shape, 'sine')
      assert.deepStrictEqual(instrument1.gain.initial, numeric('db', -6))

      const instrument2 = result.instruments.get(2 as any)
      assert.strictEqual(instrument2?.source.type, 'oscillator')
      assert.strictEqual(instrument2.source.shape, 'sine')
      assert.deepStrictEqual(instrument2.gain.initial, numeric('db', -12))

      assert.deepStrictEqual(result.automations.size, 2)
      assert.deepStrictEqual(result.instruments.get(1 as any)?.gain.id, 1 as any)
      assert.deepStrictEqual(result.instruments.get(2 as any)?.gain.id, 2 as any)
      assert.deepStrictEqual(result.automations.get(1 as any)?.parameterId, 1 as any)
      assert.deepStrictEqual(result.automations.get(2 as any)?.parameterId, 2 as any)
    })
  })
})
