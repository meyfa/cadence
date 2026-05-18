/**
 * @import { AudioWorkletGlobalScope, AudioWorkletProcessInputs, AudioWorkletProcessOutputs } from '../worklets/types.js'
 */

const workletScope = /** @type {AudioWorkletGlobalScope} */ (/** @type {unknown} */ (globalThis))

class CadenceTimeTrackerProcessor extends workletScope.AudioWorkletProcessor {
  #framesUntilPost
  #postIntervalFrames

  constructor () {
    super()

    this.#postIntervalFrames = 1200 // ~25ms at 48kHz
    this.#framesUntilPost = 0

    /**
     * @param {MessageEvent} event
     */
    this.port.onmessage = (event) => {
      if (event.data == null || typeof event.data !== 'object' || event.data.type !== 'init') {
        return
      }

      const { postIntervalFrames } = event.data
      if (typeof postIntervalFrames !== 'number') {
        return
      }

      this.#postIntervalFrames = Math.max(1, Math.floor(postIntervalFrames))
      this.#framesUntilPost = 0
    }
  }

  /**
   * @param {AudioWorkletProcessInputs} inputs
   * @param {AudioWorkletProcessOutputs} outputs
   */
  process (inputs, outputs) {
    const output = outputs[0]
    if (output?.[0] == null) {
      return true
    }

    this.#framesUntilPost -= output[0].length

    if (this.#framesUntilPost <= 0) {
      this.#framesUntilPost += this.#postIntervalFrames
      this.port.postMessage({ type: 'time', currentTime: workletScope.currentTime })
    }

    return true
  }
}

workletScope.registerProcessor('cadence-time-tracker', CadenceTimeTrackerProcessor)
