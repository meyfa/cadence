import { expect } from 'vitest'

// generation

export function fillSignal (target: Float32Array, options: {
  readonly sampleRate: number
  readonly frequency: number
  readonly phase?: number
}): Float32Array {
  const { sampleRate, frequency, phase = 0 } = options

  for (let i = 0; i < target.length; ++i) {
    target[i] = Math.sin(i * frequency * 2 * Math.PI / sampleRate + phase)
  }

  return target
}

// metrics

export function average (values: Float32Array, options?: {
  readonly start?: number
  readonly end?: number
}): number {
  const { start = 0, end = values.length } = options ?? {}

  let sum = 0

  for (let i = start; i < end; ++i) {
    sum += values[i]
  }

  return sum / (end - start)
}

// assertions

export function expectSamplesClose (
  actual: Float32Array,
  expected: Float32Array,
  message?: string,
  digits = 6
) {
  expect(actual.length, message).toBe(expected.length)

  for (let i = 0; i < actual.length; ++i) {
    const sampleMessage = message == null ? `sample ${i}` : `${message}, sample ${i}`
    expect(actual[i], sampleMessage).toBeCloseTo(expected[i], digits)
  }
}
