/**
 * @import { AudioWorkletGlobalScope, AudioWorkletProcessInputs, AudioWorkletProcessOutputs } from '../types.ts'
 * @import { MeterConfiguration } from './messages.ts'
 */

const workletScope = /** @type {AudioWorkletGlobalScope} */ (/** @type {unknown} */ (globalThis))

class TimeMeterProcessor extends workletScope.AudioWorkletProcessor {
  #interval = 0
  #counter = 0

  constructor () {
    super()

    /**
     * @param {MessageEvent<MeterConfiguration>} event
     */
    this.port.onmessage = (event) => {
      this.#interval = event.data.interval
      this.#counter = 0

      this.port.postMessage('ready')
    }
  }

  /**
   * @param {AudioWorkletProcessInputs} inputs
   * @param {AudioWorkletProcessOutputs} outputs
   */
  process (inputs, outputs) {
    if (this.#interval <= 0) {
      return true
    }

    // For silent frames, input may be empty, so the frame count must be determined from output.
    this.#counter -= outputs[0]?.[0]?.length ?? 0

    if (this.#counter <= 0) {
      this.#counter += this.#interval
      this.port.postMessage({ time: workletScope.currentTime })
    }

    return true
  }
}

workletScope.registerProcessor('time_meter', TimeMeterProcessor)
