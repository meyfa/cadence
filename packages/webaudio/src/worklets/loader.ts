import { runtimeNumeric } from '@utility'

interface AudioContextWithWorklet extends BaseAudioContext {
  readonly audioWorklet: AudioWorklet
}

const LOAD_TIMEOUT = runtimeNumeric('s', 30)

const workletCache = new WeakMap<BaseAudioContext, Map<string, Promise<void>>>()

export async function addWorkletModule (ctx: BaseAudioContext, moduleUrl: string): Promise<void> {
  const cached = workletCache.get(ctx)?.get(moduleUrl)

  if (cached != null) {
    try {
      await cached
      return
    } catch {
      // Failed to load previously, try again
    }
  }

  const promise = add(ctx, moduleUrl, AbortSignal.timeout(LOAD_TIMEOUT.value * 1000))

  let ctxCache = workletCache.get(ctx)
  if (ctxCache == null) {
    ctxCache = new Map()
    workletCache.set(ctx, ctxCache)
  }

  ctxCache.set(moduleUrl, promise)

  try {
    await promise
  } catch (err) {
    ctxCache.delete(moduleUrl)
    throw err
  }
}

async function add (ctx: BaseAudioContext, moduleUrl: string, signal: AbortSignal): Promise<void> {
  if (!('audioWorklet' in ctx) || (ctx as any).audioWorklet == null) {
    throw new Error('AudioWorklet not available')
  }

  const load = (ctx as AudioContextWithWorklet).audioWorklet.addModule(moduleUrl)

  const abort = new Promise<void>((resolve, reject) => {
    const onAbort = () => reject(new Error('Loading AudioWorklet module aborted'))

    if (signal.aborted) {
      onAbort()
      return
    }

    signal.addEventListener('abort', onAbort, { once: true })
  })

  await Promise.race([load, abort])
}
