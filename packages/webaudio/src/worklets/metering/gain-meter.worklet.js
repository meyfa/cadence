/**
 * @import { AudioWorkletGlobalScope, AudioWorkletProcessInputs, AudioWorkletProcessOutputs } from '../types.js'
 * @import { MeterConfiguration } from './messages.js'
 */

const workletScope = /** @type {AudioWorkletGlobalScope} */ (/** @type {unknown} */ (globalThis))

class GainMeterProcessor extends workletScope.AudioWorkletProcessor {
  #interval = 0
  #counter = 0

  #peak = [0, 0]
  #sampleCount = [0, 0]
  #sumSquares = [0, 0]

  constructor () {
    super()

    /**
     * @param {MessageEvent<MeterConfiguration>} event
     */
    this.port.onmessage = (event) => {
      this.#interval = event.data.interval
      this.#counter = 0

      this.#peak = [0, 0]
      this.#sampleCount = [0, 0]
      this.#sumSquares = [0, 0]

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

    const channels = inputs[0] ?? []
    const meterChannels = channels.length === 1 ? [channels[0], channels[0]] : [channels[0], channels[1]]

    for (let channelIndex = 0; channelIndex < 2; ++channelIndex) {
      const channel = meterChannels[channelIndex]
      const frameCount = channel?.length ?? 0

      if (frameCount === 0) {
        continue
      }

      for (let i = 0; i < frameCount; ++i) {
        const value = channel[i]
        const magnitude = Math.abs(value)

        this.#sumSquares[channelIndex] += value * value
        this.#peak[channelIndex] = Math.max(this.#peak[channelIndex], magnitude)
      }

      this.#sampleCount[channelIndex] += frameCount
    }

    const frameCount = channels[0]?.length ?? channels[1]?.length ?? 0

    this.#counter -= frameCount

    if (this.#counter <= 0) {
      this.#counter += this.#interval

      const rms = [0, 1].map((channelIndex) => {
        const sampleCount = this.#sampleCount[channelIndex]
        return sampleCount > 0 ? Math.sqrt(this.#sumSquares[channelIndex] / sampleCount) : 0
      })

      this.port.postMessage({ peak: this.#peak, rms })

      this.#peak = [0, 0]
      this.#sampleCount = [0, 0]
      this.#sumSquares = [0, 0]
    }

    return true
  }
}

workletScope.registerProcessor('gain_meter', GainMeterProcessor)
