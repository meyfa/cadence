import type { Curve, CurveShape } from '@meyfa/cadence-core'
import type { Numeric, Unit } from '@meyfa/cadence-utility'
import type { Transport } from '../transport/transport.ts'

export function automate<U extends Unit> (transport: Transport, param: AudioParam, source: Curve<'s', U>): void {
  param.value = source.initial

  const points = source.points
  if (points.length === 0) {
    return
  }

  transport.schedule(0 as Numeric<'s'>, (time) => {
    param.setValueAtTime(source.initial, 0)

    // Precompute point times
    const pointTimes = points.map((point) => time + point.time)

    let pointIndex = 0

    // Skip segments that are entirely in the past, excluding the final point at or before time 0
    while (pointIndex < pointTimes.length - 1) {
      if (pointTimes[pointIndex + 1] <= 0) {
        ++pointIndex
      } else {
        break
      }
    }

    let previousTime = 0
    let previousValue = source.initial

    // If the next point is precisely at time 0, set the value immediately
    if (pointTimes[pointIndex] === 0) {
      const point = points[pointIndex]
      previousValue = point.value
      param.setValueAtTime(previousValue, pointTimes[pointIndex])
      ++pointIndex
    }

    // If it is still in the past, we need to find the value at time 0
    if (pointTimes[pointIndex] < 0) {
      if (pointIndex + 1 >= points.length) {
        // Not enough points, but we can at least set the final value
        param.setValueAtTime(points[pointIndex].value, 0)
        return
      }

      const point = points[pointIndex]
      const pointTime = pointTimes[pointIndex]

      const nextPoint = points[pointIndex + 1]
      const nextPointTime = pointTimes[pointIndex + 1]

      const t = (0 - pointTime) / (nextPointTime - pointTime)
      const value = evaluateCurve(nextPoint.shape, t, point.value, nextPoint.value)

      param.setValueAtTime(value, 0)
      previousValue = value

      ++pointIndex
    }

    // Schedule remaining points (guaranteed to be in the future)
    for (let i = pointIndex; i < points.length; ++i) {
      const pointTime = pointTimes[i]
      const { value, shape } = points[i]

      scheduleToPoint(transport, param, {
        shape,
        time: pointTime,
        value,
        previousTime,
        previousValue
      })

      previousTime = pointTime
      previousValue = value
    }
  })
}

export function applyAutomationPoints<U extends Unit> (time: number, transport: Transport, param: AudioParam, source: Curve<'s', U>): void {
  param.value = source.initial

  const points = source.points
  if (points.length === 0) {
    return
  }

  let previousTime = time
  let previousValue = source.initial

  param.setValueAtTime(previousValue, previousTime)

  for (const point of points) {
    const pointTime = time + point.time
    const { value, shape: shape } = point

    scheduleToPoint(transport, param, {
      shape,
      time: pointTime,
      value,
      previousTime,
      previousValue
    })

    previousTime = pointTime
    previousValue = value
  }
}

function evaluateCurve<const U extends Unit> (shape: CurveShape, t: number, startValue: Numeric<U>, endValue: Numeric<U>): Numeric<U> {
  if (t <= 0) {
    return startValue
  }

  if (t >= 1) {
    return endValue
  }

  switch (shape) {
    case 'step':
      return startValue

    case 'linear':
      return ((1 - t) * startValue + t * endValue) as Numeric<U>

    case 'exponential': {
      // Exponential interpolation is multiplicative / log-linear:
      //   v(t) = start * (end/start)^t = exp((1-t)ln(start) + t ln(end))
      // The choice of log base is irrelevant (it cancels out). For gain values derived
      // from dB via `10^(dB/20)`, this matches a linear ramp in dB.
      //
      // Web Audio exponential ramps cannot reach or pass through 0, but users may
      // still expect an exponential *shape* that hits exactly 0 at the endpoint.
      // For evaluation, we treat 0 endpoints as "approach 0" using a tiny positive
      // value, but preserve exact equality at t=0 and t=1.

      const safeStart = startValue > 0 ? startValue : Number.EPSILON
      const safeEnd = endValue > 0 ? endValue : Number.EPSILON

      return (Math.exp((1 - t) * Math.log(safeStart) + t * Math.log(safeEnd))) as Numeric<U>
    }
  }
}

function scheduleToPoint (
  transport: Transport,
  param: AudioParam,
  options: {
    readonly shape: CurveShape
    readonly time: number
    readonly value: number
    readonly previousTime: number
    readonly previousValue: number
  }
): void {
  const { shape, time, value, previousTime, previousValue } = options

  if (time === previousTime) {
    param.setValueAtTime(value, time)
    return
  }

  switch (shape) {
    case 'step':
      param.setValueAtTime(value, time)
      return

    case 'linear':
      param.linearRampToValueAtTime(value, time)
      return

    case 'exponential': {
      // WebAudio exponential ramps are only defined for strictly positive values,
      // including the *starting* value of the segment.
      //
      // If a segment starts at 0 (or <= 0), we keep exact 0 at the start time but
      // introduce a tiny positive value one sample later so the exponential ramp can
      // proceed without changing the curve type.

      const dt = 1 / transport.ctx.sampleRate
      const startTime = previousTime + dt

      if (previousValue <= 0) {
        if (startTime >= time) {
          // Segment too short to do anything meaningful.
          param.setValueAtTime(value, time)
          return
        }

        param.setValueAtTime(Number.EPSILON, startTime)
      }

      if (value <= 0) {
        // Preserve exponential shape but still reach exactly 0 at the endpoint.
        param.exponentialRampToValueAtTime(Number.EPSILON, time)
        param.setValueAtTime(0, time)
        return
      }

      param.exponentialRampToValueAtTime(value, time)
      return
    }
  }
}
