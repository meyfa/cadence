import type { NodeId } from '@audiograph'
import { numeric, type Numeric } from '@utility'
import { describe, expect, it } from 'vitest'
import { createWidthInstance } from '../../src/graph/effect.js'
import type { Transport } from '../../src/transport/transport.js'
import { average, expectSamplesClose, fillSignal } from '../helpers.js'

const sampleRate = 48_000
const length = 1024

function createTestTransport () {
  const ctx = new OfflineAudioContext({ sampleRate, length, numberOfChannels: 2 })
  const transport: Transport = {
    ctx,
    output: ctx.createGain(),
    schedule: (_time, onSchedule) => onSchedule(0)
  }

  return { ctx, transport }
}

async function renderWidth (options: {
  readonly width: Numeric<undefined>
  readonly inputChannels: number
  readonly fill: (buffer: AudioBuffer) => void
}): Promise<{
  readonly input: AudioBuffer
  readonly output: AudioBuffer
}> {
  const { width, inputChannels, fill } = options

  const { ctx, transport } = createTestTransport()

  const instance = createWidthInstance({
    id: 42 as NodeId,
    type: 'width',
    width
  }, transport)

  try {
    const input = ctx.createBuffer(inputChannels, length, sampleRate)
    fill(input)

    const source = ctx.createBufferSource()
    source.buffer = input

    source.connect(instance.input ?? ctx.destination)
    instance.output?.connect(ctx.destination)

    source.start(0)

    const output = await ctx.startRendering()

    return { input, output }
  } finally {
    instance.dispose()
  }
}

describe('graph/effect.ts', () => {
  describe('createWidthInstance', () => {
    it('renders mono-compatible output when width = 0', async () => {
      const { output } = await renderWidth({
        width: numeric(undefined, 0),
        inputChannels: 2,
        fill: (input) => {
          input.getChannelData(0).fill(1)
          input.getChannelData(1).fill(0)
        }
      })

      expect(average(output.getChannelData(0))).toBeCloseTo(0.5, 3)
      expect(average(output.getChannelData(1))).toBeCloseTo(0.5, 3)
    })

    it('swaps stereo channels when width = -1', async () => {
      const { output } = await renderWidth({
        width: numeric(undefined, -1),
        inputChannels: 2,
        fill: (input) => {
          input.getChannelData(0).fill(1)
          input.getChannelData(1).fill(0)
        }
      })

      expect(average(output.getChannelData(0))).toBeCloseTo(0, 3)
      expect(average(output.getChannelData(1))).toBeCloseTo(1, 3)
    })

    it('applies weighted stereo mix when width = 0.5', async () => {
      const { output } = await renderWidth({
        width: numeric(undefined, 0.5),
        inputChannels: 2,
        fill: (input) => {
          input.getChannelData(0).fill(1)
          input.getChannelData(1).fill(0)
        }
      })

      expect(average(output.getChannelData(0))).toBeCloseTo(0.75, 3)
      expect(average(output.getChannelData(1))).toBeCloseTo(0.25, 3)
    })

    it('passes through unmodified stereo signal when width = 1', async () => {
      const { input, output } = await renderWidth({
        width: numeric(undefined, 1),
        inputChannels: 2,
        fill: (input) => {
          fillSignal(input.getChannelData(0), { sampleRate, frequency: 440 })
          fillSignal(input.getChannelData(1), { sampleRate, frequency: 440, phase: Math.PI })
        }
      })

      expectSamplesClose(output.getChannelData(0), input.getChannelData(0))
      expectSamplesClose(output.getChannelData(1), input.getChannelData(1))
    })

    it('keeps mono the same for any width', async () => {
      for (const widthValue of [-1, -0.5, 0, 0.5, 1]) {
        const { input, output } = await renderWidth({
          width: numeric(undefined, widthValue),
          inputChannels: 2,
          fill: (input) => {
            const mono = fillSignal(input.getChannelData(0), { sampleRate, frequency: 440 })
            input.getChannelData(1).set(mono)
          }
        })

        expectSamplesClose(output.getChannelData(0), input.getChannelData(0), `width = ${widthValue}`)
        expectSamplesClose(output.getChannelData(1), input.getChannelData(1), `width = ${widthValue}`)
      }
    })

    it('upmixes mono input to stereo', async () => {
      // If there was no upmixing, the input would be panned hard left, and the right channel would be silent.
      // With upmixing, the output should be the same in both channels.

      const { input, output } = await renderWidth({
        width: numeric(undefined, 1),
        inputChannels: 1,
        fill: (input) => {
          fillSignal(input.getChannelData(0), { sampleRate, frequency: 440 })
        }
      })

      expectSamplesClose(output.getChannelData(0), input.getChannelData(0))
      expectSamplesClose(output.getChannelData(1), input.getChannelData(0))
    })

    it('does not clamp out-of-range width values', async () => {
      const expanded = await renderWidth({
        width: numeric(undefined, 1.5),
        inputChannels: 2,
        fill: (input) => {
          input.getChannelData(0).fill(1)
          input.getChannelData(1).fill(0)
        }
      })

      expect(average(expanded.output.getChannelData(0))).toBeCloseTo(1.25, 3)
      expect(average(expanded.output.getChannelData(1))).toBeCloseTo(-0.25, 3)

      const inverted = await renderWidth({
        width: numeric(undefined, -1.5),
        inputChannels: 2,
        fill: (input) => {
          input.getChannelData(0).fill(1)
          input.getChannelData(1).fill(0)
        }
      })

      expect(average(inverted.output.getChannelData(0))).toBeCloseTo(-0.25, 3)
      expect(average(inverted.output.getChannelData(1))).toBeCloseTo(1.25, 3)
    })
  })
})
