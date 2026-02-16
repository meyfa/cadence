import { MutableObservable } from '@core/observable.js'
import { makeNumeric } from '@core/program.js'
import type { TimeTracker, TimeTrackerOptions } from './common.js'

const PROCESSOR_NAME = 'cadence-time-tracker'
const moduleLoadPromises = new WeakMap<BaseAudioContext, Promise<void>>()

export async function createWorkletTimeTracker (
  ctx: BaseAudioContext,
  connectTo: AudioNode,
  options: TimeTrackerOptions
): Promise<TimeTracker> {
  const { updateInterval, offsetTime } = options

  const time = new MutableObservable(makeNumeric('s', 0))

  await ensureModuleLoaded(ctx)

  const node = new AudioWorkletNode(ctx, PROCESSOR_NAME, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1]
  })

  let disposed = false

  const postIntervalFrames = Math.max(1, Math.round(updateInterval.value * ctx.sampleRate))
  node.port.postMessage({ type: 'init', postIntervalFrames })

  node.port.onmessage = (event: MessageEvent<unknown>) => {
    if (disposed || event.data == null || typeof event.data !== 'object' || !('type' in event.data) || typeof event.data.type !== 'string') {
      return
    }

    if (event.data.type === 'time') {
      const { currentTime } = event.data as unknown as { currentTime: number }
      time.set(makeNumeric('s', currentTime - offsetTime.value))
    }
  }

  node.connect(connectTo)

  const dispose = () => {
    if (disposed) {
      return
    }

    disposed = true

    node.port.onmessage = null
    node.disconnect()
  }

  return { time, dispose }
}

async function ensureModuleLoaded (ctx: BaseAudioContext): Promise<void> {
  if (!('audioWorklet' in ctx) || (ctx as any).audioWorklet == null) {
    throw new Error('AudioWorklet not available')
  }

  const existing = moduleLoadPromises.get(ctx)
  if (existing != null) {
    await existing
    return
  }

  try {
    const promise = (async () => {
      const source = createProcessorModuleSource()
      const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))

      try {
        await (ctx as any).audioWorklet.addModule(url)
      } finally {
        URL.revokeObjectURL(url)
      }
    })()

    moduleLoadPromises.set(ctx, promise)
    await promise
  } catch (err: unknown) {
    moduleLoadPromises.delete(ctx)
    throw err
  }
}

function createProcessorModuleSource (): string {
  return `
class CadenceTimeTrackerProcessor extends AudioWorkletProcessor {
  #framesUntilPost
  #postIntervalFrames

  constructor () {
    super()

    this.#framesUntilPost = 0
    this.#postIntervalFrames = 1200 // ~25ms at 48kHz

    this.port.onmessage = (event) => {
      if (event == null || event.data == null || typeof event.data !== 'object' || event.data.type !== 'init') {
        return
      }

      const { postIntervalFrames } = event.data

      this.#postIntervalFrames = Math.max(1, Math.floor(postIntervalFrames))
      this.#framesUntilPost = 0
    }
  }

  process (inputs, outputs) {
    const output = outputs[0]
    if (output == null || output[0] == null) {
      return true
    }

    const frames = output[0].length
    this.#framesUntilPost -= frames

    if (this.#framesUntilPost <= 0) {
      this.#framesUntilPost += this.#postIntervalFrames
      this.port.postMessage({ type: 'time', currentTime })
    }

    return true
  }
}

registerProcessor('${PROCESSOR_NAME}', CadenceTimeTrackerProcessor);
`.trimStart()
}
