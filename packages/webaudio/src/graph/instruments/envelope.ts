import type { Envelope } from '@core'

export interface EnvelopeTarget {
  cancelScheduledValues(time: number): void
  setValueAtTime(value: number, time: number): void
  linearRampToValueAtTime(value: number, time: number): void
}

export interface EnvelopeOptions {
  readonly time: number
  readonly velocity: number
  readonly holdDuration?: number
}

export function applyEnvelope (envelope: Envelope, target: EnvelopeTarget, options: EnvelopeOptions): void {
  const { time, velocity, holdDuration } = options

  const attack = envelope.attack.value
  const decay = envelope.decay.value
  const sustain = envelope.sustain.value
  const release = envelope.release.value

  const sustainLevel = velocity * sustain

  const attackStartTime = time
  const attackEndTime = time + attack

  const decayEndTime = attackEndTime + decay

  // attack
  if (attackEndTime > attackStartTime) {
    target.setValueAtTime(0, attackStartTime)
    target.linearRampToValueAtTime(velocity, attackEndTime)
  } else {
    target.setValueAtTime(velocity, attackStartTime)
  }

  // decay and sustain
  if (decayEndTime > attackEndTime) {
    target.linearRampToValueAtTime(sustainLevel, decayEndTime)
  } else {
    target.setValueAtTime(sustainLevel, attackEndTime)
  }

  // release
  if (holdDuration != null) {
    const releaseStartTime = time + holdDuration
    const releaseEndTime = releaseStartTime + release

    const releaseStartLevel = (() => {
      // in sustain phase
      if (releaseStartTime >= decayEndTime) {
        return sustainLevel
      }

      // in decay phase
      if (decay > 0 && releaseStartTime >= attackEndTime) {
        const decayProgress = (releaseStartTime - attackEndTime) / decay
        return velocity + ((sustainLevel - velocity) * decayProgress)
      }

      // in attack phase
      const attackProgress = (releaseStartTime - attackStartTime) / attack
      return velocity * attackProgress
    })()

    target.cancelScheduledValues(releaseStartTime)

    if (releaseEndTime > releaseStartTime) {
      target.setValueAtTime(releaseStartLevel, releaseStartTime)
      target.linearRampToValueAtTime(0, releaseEndTime)
    } else {
      target.setValueAtTime(0, releaseStartTime)
    }
  }
}
