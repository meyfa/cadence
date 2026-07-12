import type { Curve, CurvePoint } from '@core'
import { gainToDb } from '@core'
import type { Numeric } from '@utility'

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

const NEGATIVE_INFINITY_DB = -Infinity as Numeric<'db'>
const RELATIVE_SILENCE_DB = -60 as Numeric<'db'>

export function applyEnvelope (envelope: Envelope, options: EnvelopeOptions): Curve<'s', 'db'> {
  const points: Array<CurvePoint<'s', 'db'>> = []
  const velocityDb = gainToDb(options.velocity)

  const startTime = 0 as Numeric<'s'>
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
    endTime: envelope.attack + envelope.decay as Numeric<'s'>,
    endValue: velocityDb + envelope.sustain as Numeric<'db'>
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
  if (gate != null && gate <= startTime) {
    return
  }

  // check if segment can be added in full
  if (gate == null || gate >= endTime) {
    addLinearSegment(points, startTime, startValue, endTime, endValue)
    return
  }

  // split segments that are interrupted by the note release

  // if the segment is completely silent, we can just add a single point at the gate time
  if (!Number.isFinite(startValue) && !Number.isFinite(endValue)) {
    addStep(points, gate, NEGATIVE_INFINITY_DB)
    return
  }

  const t = (gate - startTime) / (endTime - startTime)

  const finiteStartValue = Number.isFinite(startValue)
    ? startValue
    : endValue + RELATIVE_SILENCE_DB as Numeric<'db'>

  const finiteEndValue = Number.isFinite(endValue)
    ? endValue
    : startValue + RELATIVE_SILENCE_DB as Numeric<'db'>

  const interpolatedValue = (finiteStartValue + t * (finiteEndValue - finiteStartValue)) as Numeric<'db'>
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

  const releaseEndTime = releaseStartTime + envelope.release as Numeric<'s'>
  const releaseEndValue = NEGATIVE_INFINITY_DB

  addLinearSegment(points, releaseStartTime, releaseStartValue, releaseEndTime, releaseEndValue)
}

function addStep (points: Array<CurvePoint<'s', 'db'>>, time: Numeric<'s'>, value: Numeric<'db'>): void {
  const lastPoint = points.at(-1)

  // only add points that change either value or time
  if (lastPoint?.time === time && lastPoint.value === value) {
    return
  }

  // do not keep redundant points
  if (lastPoint?.shape === 'step' && lastPoint.time >= time) {
    points.pop()
  }

  points.push({ time, value, shape: 'step' })
}

function addLinearSegment (points: Array<CurvePoint<'s', 'db'>>, startTime: Numeric<'s'>, startValue: Numeric<'db'>, endTime: Numeric<'s'>, endValue: Numeric<'db'>): void {
  // if the segment has zero length, we can just add a single point at the end time
  if (endTime <= startTime) {
    addStep(points, endTime, endValue)
    return
  }

  const isStartFinite = Number.isFinite(startValue)
  const isEndFinite = Number.isFinite(endValue)

  if (isStartFinite && isEndFinite) {
    addStep(points, startTime, startValue)
    points.push({ time: endTime, value: endValue, shape: 'linear' })
  } else if (isStartFinite) {
    addStep(points, startTime, startValue)
    const finiteEndValue = startValue + RELATIVE_SILENCE_DB as Numeric<'db'>
    points.push({ time: endTime, value: finiteEndValue, shape: 'linear' })
    addStep(points, endTime, endValue)
  } else if (isEndFinite) {
    const finiteStartValue = endValue + RELATIVE_SILENCE_DB as Numeric<'db'>
    addStep(points, startTime, finiteStartValue)
    points.push({ time: endTime, value: endValue, shape: 'linear' })
  } else {
    addStep(points, startTime, startValue)
    addStep(points, endTime, endValue)
  }
}
