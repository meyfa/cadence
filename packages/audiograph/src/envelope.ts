import type { TimeVariant, TimeVariantPoint } from './automation.js'
import { timeVariant } from './automation.js'
import type { Envelope } from '@core'
import type { Numeric } from '@utility'
import { numeric } from '@utility'

export interface EnvelopeOptions {
  readonly velocity: Numeric<undefined>
  readonly gate?: Numeric<'s'>
}

const ZERO_GAIN = numeric(undefined, 0)

export function applyEnvelope (envelope: Envelope, options: EnvelopeOptions): TimeVariant<undefined> {
  const points: Array<TimeVariantPoint<undefined>> = []

  // attack (silence -> peak)
  applySegment(points, options, {
    startTime: 0,
    startValue: 0,
    endTime: envelope.attack.value,
    endValue: options.velocity.value
  })

  // decay (peak -> sustain)
  applySegment(points, options, {
    startTime: envelope.attack.value,
    startValue: options.velocity.value,
    endTime: envelope.attack.value + envelope.decay.value,
    endValue: envelope.sustain.value * options.velocity.value
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
  const { gate } = options
  const { startTime, startValue, endTime, endValue } = segment

  if (gate != null && gate.value <= startTime) {
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

  if (gate != null && gate.value < endTime) {
    const t = (gate.value - startTime) / (endTime - startTime)
    const holdValue = startValue + t * (endValue - startValue)
    points.push({ time: gate, value: numeric(undefined, holdValue), curve: 'linear' })
    return
  }

  points.push({ time: numeric('s', endTime), value: numeric(undefined, endValue), curve: 'linear' })
}

function applyRelease (points: Array<TimeVariantPoint<undefined>>, envelope: Envelope, options: EnvelopeOptions): void {
  const { gate } = options
  if (gate == null) {
    return
  }

  const lastPoint = points.at(-1)
  const release = envelope.release.value

  if (lastPoint == null || release <= 0) {
    points.push({ time: gate, value: ZERO_GAIN, curve: 'step' })
    return
  }

  const releaseStartTime = gate
  const releaseStartValue = lastPoint.value.value

  if (releaseStartTime.value > lastPoint.time.value) {
    points.push({ time: releaseStartTime, value: numeric(undefined, releaseStartValue), curve: 'step' })
  }

  points.push({ time: numeric('s', releaseStartTime.value + release), value: ZERO_GAIN, curve: 'linear' })
}
