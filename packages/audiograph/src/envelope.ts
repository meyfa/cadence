import type { TimeVariant, TimeVariantPoint } from './automation.js'
import { timeVariant } from './automation.js'
import type { Envelope } from '@core'
import { numeric } from '@utility'

export interface EnvelopeOptions {
  readonly velocity: number
  readonly duration?: number
}

const ZERO_GAIN = numeric(undefined, 0)

export function applyEnvelope (envelope: Envelope, options: EnvelopeOptions): TimeVariant<undefined> {
  const points: Array<TimeVariantPoint<undefined>> = []

  // attack (silence -> peak)
  applySegment(points, options, {
    startTime: 0,
    startValue: 0,
    endTime: envelope.attack.value,
    endValue: options.velocity
  })

  // decay (peak -> sustain)
  applySegment(points, options, {
    startTime: envelope.attack.value,
    startValue: options.velocity,
    endTime: envelope.attack.value + envelope.decay.value,
    endValue: envelope.sustain.value * options.velocity
  })

  // hold and release (sustain -> silence)
  applyRelease(points, envelope, options)

  return timeVariant(ZERO_GAIN, points)
}

function applySegment (points: Array<TimeVariantPoint<undefined>>, options: EnvelopeOptions, segment: {
  readonly startTime: number
  readonly startValue: number
  readonly endTime: number
  readonly endValue: number
}): void {
  const { duration } = options
  const { startTime, startValue, endTime, endValue } = segment

  if (duration != null && duration <= startTime) {
    return
  }

  const lastPoint = points.at(-1)

  if (endTime <= startTime) {
    points.push({ time: numeric('s', startTime), value: numeric(undefined, endValue), curve: 'step' })
    return
  }

  if (lastPoint == null || lastPoint.time.value < startTime) {
    points.push({ time: numeric('s', startTime), value: numeric(undefined, startValue), curve: 'step' })
  }

  if (duration != null && duration < endTime) {
    const t = (duration - startTime) / (endTime - startTime)
    const holdValue = startValue + t * (endValue - startValue)
    points.push({ time: numeric('s', duration), value: numeric(undefined, holdValue), curve: 'linear' })
    return
  }

  points.push({ time: numeric('s', endTime), value: numeric(undefined, endValue), curve: 'linear' })
}

function applyRelease (points: Array<TimeVariantPoint<undefined>>, envelope: Envelope, options: EnvelopeOptions): void {
  const { duration } = options
  if (duration == null) {
    return
  }

  const lastPoint = points.at(-1)
  const release = envelope.release.value

  if (lastPoint == null || release <= 0) {
    points.push({ time: numeric('s', duration), value: ZERO_GAIN, curve: 'step' })
    return
  }

  const releaseStartTime = duration
  const releaseStartValue = lastPoint.value.value

  if (releaseStartTime > lastPoint.time.value) {
    points.push({ time: numeric('s', releaseStartTime), value: numeric(undefined, releaseStartValue), curve: 'step' })
  }

  points.push({ time: numeric('s', releaseStartTime + release), value: ZERO_GAIN, curve: 'linear' })
}
