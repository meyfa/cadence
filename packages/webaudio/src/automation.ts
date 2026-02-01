import type { Numeric, Parameter, Program, Unit } from '@core/program.js'
import { beatsToSeconds } from '@core/time.js'
import { dbToGain } from './conversion.js'
import type { Transport } from './transport.js'

export type ParameterType = 'gain' | 'frequency'

export function automate<U extends Unit> (
  transport: Transport,
  param: AudioParam,
  type: ParameterType,
  program: Program,
  parameter: Parameter<U>
): void {
  const initialValue = toParamValue(type, parameter.initial)
  param.value = initialValue

  const automation = program.automations.get(parameter.id)
  if (automation == null || automation.points.length === 0) {
    return
  }

  transport.schedule(0, (time) => {
    param.setValueAtTime(initialValue, 0)

    // Precompute point times
    const pointTimes = automation.points.map((point) => {
      return time + beatsToSeconds(point.time, program.track.tempo).value
    })

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
    let previousValue = initialValue

    // If the next point is precisely at time 0, set the value immediately
    if (pointTimes[pointIndex] === 0) {
      const point = automation.points[pointIndex]
      previousValue = toParamValue(type, point.value)
      param.setValueAtTime(previousValue, pointTimes[pointIndex])
      ++pointIndex
    }

    // If it is still in the past, we need to find the value at time 0
    if (pointTimes[pointIndex] < 0) {
      if (pointIndex + 1 >= automation.points.length) {
        // Not enough points
        return
      }

      const point = automation.points[pointIndex]
      const pointTime = pointTimes[pointIndex]

      const nextPoint = automation.points[pointIndex + 1]
      const nextPointTime = pointTimes[pointIndex + 1]

      const t = (0 - pointTime) / (nextPointTime - pointTime)

      const startValue = toParamValue(type, point.value)
      const endValue = toParamValue(type, nextPoint.value)
      const value = evaluateCurve(
        transformCurve(type, nextPoint.curve),
        t,
        startValue,
        endValue
      )

      param.setValueAtTime(value, 0)
      previousValue = value

      ++pointIndex
    }

    // Schedule remaining points (guaranteed to be in the future)
    for (let i = pointIndex; i < automation.points.length; ++i) {
      const pointTime = pointTimes[i]

      const point = automation.points[i]
      const curve = transformCurve(type, point.curve)
      const pointValue = toParamValue(type, point.value)

      scheduleToPoint(transport, param, {
        curve,
        time: pointTime,
        value: pointValue,
        previousTime,
        previousValue
      })

      previousTime = pointTime
      previousValue = pointValue
    }
  })
}

function toParamValue (type: ParameterType, { value }: Numeric<Unit>): number {
  switch (type) {
    case 'gain':
      return dbToGain(value)

    case 'frequency':
      return value
  }
}

type Curve = 'step' | 'linear' | 'exponential'

function transformCurve (type: ParameterType, curve: Curve): Curve {
  switch (type) {
    case 'gain':
      return transformDbToGainCurve(curve)

    case 'frequency':
      return curve
  }
}

function transformDbToGainCurve (curve: Curve): Curve {
  switch (curve) {
    case 'step':
      return 'step'

    case 'linear':
      return 'exponential'

    case 'exponential':
      throw new Error()
  }
}

function evaluateCurve (curve: Curve, t: number, startValue: number, endValue: number): number {
  if (t <= 0) {
    return startValue
  }

  if (t >= 1) {
    return endValue
  }

  switch (curve) {
    case 'step':
      return startValue

    case 'linear':
      return (1 - t) * startValue + t * endValue

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

      return Math.exp((1 - t) * Math.log(safeStart) + t * Math.log(safeEnd))
    }
  }
}

function scheduleToPoint (
  transport: Transport,
  param: AudioParam,
  options: {
    readonly curve: Curve
    readonly time: number
    readonly value: number
    readonly previousTime: number
    readonly previousValue: number
  }
): void {
  const { curve, time, value, previousTime, previousValue } = options

  if (time === previousTime) {
    param.setValueAtTime(value, time)
    return
  }

  switch (curve) {
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
