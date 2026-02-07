import assert from 'node:assert'
import { describe, it } from 'node:test'
import { createScheduler } from '../src/scheduler.js'

type SetInterval = typeof globalThis.setInterval
type ClearInterval = typeof globalThis.clearInterval

describe('scheduler.ts', () => {
  it('runs callbacks shortly before their target time', () => {
    let nowSeconds = 10

    let intervalCallback: (() => void) | undefined

    const scheduler = createScheduler({
      now: () => nowSeconds,
      tickInterval: 0.01,
      scheduleAheadTime: 0.05,

      timers: {
        setInterval: ((handler: unknown) => {
          intervalCallback = () => typeof handler === 'function' ? handler() : {}
          return 1
        }) as SetInterval,

        clearInterval: (() => {
          intervalCallback = undefined
        }) as ClearInterval
      }
    })

    scheduler.start(10)

    let called = false
    let callNow: number | undefined
    let targetTime: number | undefined

    scheduler.schedule(1, (time) => {
      called = true
      callNow = nowSeconds
      targetTime = time
    })

    // Not yet within the schedule-ahead window
    nowSeconds = 10.9
    intervalCallback?.()
    assert.strictEqual(called, false)

    // Enter the window: transportNow=0.96, threshold=1.01 -> event time 1 runs
    nowSeconds = 10.96
    intervalCallback?.()

    assert.strictEqual(called, true)
    assert.strictEqual(targetTime, 11)
    assert.ok(callNow != null && callNow < targetTime)
  })

  it('executes past events immediately on start', () => {
    const nowSeconds = 10

    const scheduler = createScheduler({
      now: () => nowSeconds,
      tickInterval: 0.01,
      scheduleAheadTime: 0.05,

      timers: {
        setInterval: (() => 1) as unknown as SetInterval,
        clearInterval: (() => {}) as ClearInterval
      }
    })

    let called = false
    let targetTime = undefined

    scheduler.schedule(-0.5, (time) => {
      called = true
      targetTime = time
    })

    scheduler.start(10)

    assert.strictEqual(called, true)
    assert.strictEqual(targetTime, 9.5)
  })

  it('preserves chronological callback order', () => {
    let nowSeconds = 10

    let intervalCallback: (() => void) | undefined

    const scheduler = createScheduler({
      now: () => nowSeconds,
      tickInterval: 0.01,
      scheduleAheadTime: 0.05,

      timers: {
        setInterval: ((handler: unknown) => {
          intervalCallback = () => typeof handler === 'function' ? handler() : {}
          return 1
        }) as SetInterval,

        clearInterval: (() => {
          intervalCallback = undefined
        }) as ClearInterval
      }
    })

    // Schedule out of order before start
    const calls: number[] = []
    scheduler.schedule(2, (time) => calls.push(time))
    scheduler.schedule(1, (time) => calls.push(time))

    scheduler.start(10)

    // Move time until both are within the window
    nowSeconds = 11.96 // transportNow=1.96 -> threshold=2.01
    intervalCallback?.()

    assert.deepStrictEqual(calls, [11, 12])
  })
})
