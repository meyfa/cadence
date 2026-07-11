import type { Curve, CurvePoint } from '@core'
import { gainToDb } from '@core'
import type { Numeric } from '@utility'
import { numeric } from '@utility'

export interface Envelope {
  readonly attack: Numeric<'s'>
  readonly decay: Numeric<'s'>
  readonly sustain: Numeric<'db'>
  readonly release: Numeric<'s'>
}

export interface EnvelopeOptions {
  readonly velocity: Numeric<undefined>
  readonly gate: Numeric<'s'> | undefined
}

const NEGATIVE_INFINITY_DB = numeric('db', -Infinity)
const RELATIVE_SILENCE_DB = numeric('db', -60)

export function applyEnvelope (envelope: Envelope, options: EnvelopeOptions): Curve<'s', 'db'> {
  const points: Array<CurvePoint<'s', 'db'>> = []
  const velocityDb = numeric('db', gainToDb(options.velocity.value))

  const startTime = numeric('s', 0)
  const startValue = NEGATIVE_INFINITY_DB

  addStep(points, startTime, startValue)

  // attack (silence -> peak)
  applySegment(points, options, {
    startTime,
    startValue,
    endTime: envelope.attack,
    endValue: velocityDb
  })

  // decay (peak -> sustain)
  applySegment(points, options, {
    startTime: envelope.attack,
    startValue: velocityDb,
    endTime: numeric('s', envelope.attack.value + envelope.decay.value),
    endValue: numeric('db', velocityDb.value + envelope.sustain.value)
  })

  // hold and release (sustain -> silence)
  applyRelease(points, envelope, options)

  return { initial: NEGATIVE_INFINITY_DB, points }
}

function applySegment (points: Array<CurvePoint<'s', 'db'>>, options: EnvelopeOptions, segment: {
  readonly startTime: Numeric<'s'>
  readonly startValue: Numeric<'db'>
  readonly endTime: Numeric<'s'>
  readonly endValue: Numeric<'db'>
}): void {
  const { gate } = options
  const { startTime, startValue, endTime, endValue } = segment

  // do not add segments after the note release
  if (gate != null && gate.value <= startTime.value) {
    return
  }

  // check if segment can be added in full
  if (gate == null || gate.value >= endTime.value) {
    addLinearSegment(points, startTime, startValue, endTime, endValue)
    return
  }

  // split segments that are interrupted by the note release

  // if the segment is completely silent, we can just add a single point at the gate time
  if (!Number.isFinite(startValue.value) && !Number.isFinite(endValue.value)) {
    addStep(points, gate, NEGATIVE_INFINITY_DB)
    return
  }

  const t = (gate.value - startTime.value) / (endTime.value - startTime.value)

  const finiteStartValue = Number.isFinite(startValue.value)
    ? startValue
    : numeric('db', endValue.value + RELATIVE_SILENCE_DB.value)

  const finiteEndValue = Number.isFinite(endValue.value)
    ? endValue
    : numeric('db', startValue.value + RELATIVE_SILENCE_DB.value)

  const interpolatedValue = numeric('db', finiteStartValue.value + t * (finiteEndValue.value - finiteStartValue.value))
  addLinearSegment(points, startTime, finiteStartValue, gate, interpolatedValue)
}

function applyRelease (points: Array<CurvePoint<'s', 'db'>>, envelope: Envelope, options: EnvelopeOptions): void {
  const { gate } = options
  const lastPoint = points.at(-1)

  if (gate == null || lastPoint == null) {
    return
  }

  const releaseStartTime = gate
  const releaseStartValue = lastPoint.value

  const releaseEndTime = numeric('s', releaseStartTime.value + envelope.release.value)
  const releaseEndValue = NEGATIVE_INFINITY_DB

  addLinearSegment(points, releaseStartTime, releaseStartValue, releaseEndTime, releaseEndValue)
}

function addStep (points: Array<CurvePoint<'s', 'db'>>, time: Numeric<'s'>, value: Numeric<'db'>): void {
  const lastPoint = points.at(-1)

  // only add points that change either value or time
  if (lastPoint?.time.value === time.value && lastPoint.value.value === value.value) {
    return
  }

  // do not keep redundant points
  if (lastPoint?.shape === 'step' && lastPoint.time.value >= time.value) {
    points.pop()
  }

  points.push({ time, value, shape: 'step' })
}

function addLinearSegment (points: Array<CurvePoint<'s', 'db'>>, startTime: Numeric<'s'>, startValue: Numeric<'db'>, endTime: Numeric<'s'>, endValue: Numeric<'db'>): void {
  // if the segment has zero length, we can just add a single point at the end time
  if (endTime.value <= startTime.value) {
    addStep(points, endTime, endValue)
    return
  }

  const isStartFinite = Number.isFinite(startValue.value)
  const isEndFinite = Number.isFinite(endValue.value)

  if (isStartFinite && isEndFinite) {
    addStep(points, startTime, startValue)
    points.push({ time: endTime, value: endValue, shape: 'linear' })
  } else if (isStartFinite) {
    addStep(points, startTime, startValue)
    const finiteEndValue = numeric('db', startValue.value + RELATIVE_SILENCE_DB.value)
    points.push({ time: endTime, value: finiteEndValue, shape: 'linear' })
    addStep(points, endTime, endValue)
  } else if (isEndFinite) {
    const finiteStartValue = numeric('db', endValue.value + RELATIVE_SILENCE_DB.value)
    addStep(points, startTime, finiteStartValue)
    points.push({ time: endTime, value: endValue, shape: 'linear' })
  } else {
    addStep(points, startTime, startValue)
    addStep(points, endTime, endValue)
  }
}
