import type { Numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { createImmediateScheduler, createRealtimeScheduler } from '../../src/transport/scheduler.js'

type SetInterval = typeof globalThis.setInterval
type ClearInterval = typeof globalThis.clearInterval

describe('transport/scheduler.ts', () => {
  describe('createRealtimeScheduler', () => {
    it('runs callbacks shortly before their target time', () => {
      let nowSeconds = 10 as Numeric<'s'>

      let intervalCallback: (() => void) | undefined

      const scheduler = createRealtimeScheduler({
        now: () => nowSeconds,
        tickInterval: 0.01 as Numeric<'s'>,
        scheduleAheadTime: 0.05 as Numeric<'s'>,

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

      scheduler.start(10 as Numeric<'s'>)

      let called = false
      let callNow: number | undefined
      let targetTime: number | undefined

      scheduler.schedule(1 as Numeric<'s'>, (time) => {
        called = true
        callNow = nowSeconds
        targetTime = time
      })

      // Not yet within the schedule-ahead window
      nowSeconds = 10.9 as Numeric<'s'>
      intervalCallback?.()
      assert.strictEqual(called, false)

      // Enter the window: transportNow=0.96, threshold=1.01 -> event time 1 runs
      nowSeconds = 10.96 as Numeric<'s'>
      intervalCallback?.()

      assert.strictEqual(called, true)
      assert.strictEqual(targetTime, 11)
      assert.ok(callNow != null && callNow < targetTime)
    })

    it('executes past events immediately on start', () => {
      const nowSeconds = 10 as Numeric<'s'>

      const scheduler = createRealtimeScheduler({
        now: () => nowSeconds,
        tickInterval: 0.01 as Numeric<'s'>,
        scheduleAheadTime: 0.05 as Numeric<'s'>,

        timers: {
          setInterval: (() => 1) as unknown as SetInterval,
          clearInterval: (() => {}) as ClearInterval
        }
      })

      let called = false
      let targetTime = undefined

      scheduler.schedule(-0.5 as Numeric<'s'>, (time) => {
        called = true
        targetTime = time
      })

      scheduler.start(10 as Numeric<'s'>)

      assert.strictEqual(called, true)
      assert.strictEqual(targetTime, 9.5)
    })

    it('preserves chronological callback order', () => {
      let nowSeconds = 10 as Numeric<'s'>

      let intervalCallback: (() => void) | undefined

      const scheduler = createRealtimeScheduler({
        now: () => nowSeconds,
        tickInterval: 0.01 as Numeric<'s'>,
        scheduleAheadTime: 0.05 as Numeric<'s'>,

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
      scheduler.schedule(2 as Numeric<'s'>, (time) => calls.push(time))
      scheduler.schedule(1 as Numeric<'s'>, (time) => calls.push(time))

      scheduler.start(10 as Numeric<'s'>)

      // Move time until both are within the window
      nowSeconds = 11.96 as Numeric<'s'> // transportNow=1.96 -> threshold=2.01
      intervalCallback?.()

      assert.deepStrictEqual(calls, [11, 12])
    })

    it('preserves chronological callback order for events scheduled after start', () => {
      let nowSeconds = 10 as Numeric<'s'>

      let intervalCallback: (() => void) | undefined

      const scheduler = createRealtimeScheduler({
        now: () => nowSeconds,
        tickInterval: 0.01 as Numeric<'s'>,
        scheduleAheadTime: 0.05 as Numeric<'s'>,

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

      const calls: number[] = []

      scheduler.start(10 as Numeric<'s'>)
      scheduler.schedule(2 as Numeric<'s'>, (time) => calls.push(time))
      scheduler.schedule(1 as Numeric<'s'>, (time) => calls.push(time))

      nowSeconds = 11.96 as Numeric<'s'>
      intervalCallback?.()

      assert.deepStrictEqual(calls, [11, 12])
    })

    it('does not run callbacks after stop', () => {
      let nowSeconds = 10 as Numeric<'s'>

      let intervalCallback: (() => void) | undefined

      const scheduler = createRealtimeScheduler({
        now: () => nowSeconds,
        tickInterval: 0.01 as Numeric<'s'>,
        scheduleAheadTime: 0.05 as Numeric<'s'>,

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

      const calls: number[] = []

      scheduler.start(10 as Numeric<'s'>)
      scheduler.stop()

      nowSeconds = 10.96 as Numeric<'s'>
      scheduler.schedule(1 as Numeric<'s'>, (time) => calls.push(time))
      scheduler.flush()
      intervalCallback?.()

      assert.deepStrictEqual(calls, [])
    })
  })

  describe('createImmediateScheduler', () => {
    it('flushes all scheduled callbacks immediately on start', () => {
      const scheduler = createImmediateScheduler()

      const calls: number[] = []
      scheduler.schedule(2 as Numeric<'s'>, (time) => calls.push(time))
      scheduler.schedule(1 as Numeric<'s'>, (time) => calls.push(time))

      scheduler.start(10 as Numeric<'s'>)

      assert.deepStrictEqual(calls, [11, 12])
    })

    it('runs callbacks immediately after start', () => {
      const scheduler = createImmediateScheduler()

      const calls: number[] = []
      scheduler.start(10 as Numeric<'s'>)

      scheduler.schedule(2 as Numeric<'s'>, (time) => calls.push(time))
      scheduler.schedule(1 as Numeric<'s'>, (time) => calls.push(time))

      assert.deepStrictEqual(calls, [12, 11])
    })

    it('does not run callbacks after stop', () => {
      const scheduler = createImmediateScheduler()

      const calls: number[] = []
      scheduler.start(10 as Numeric<'s'>)
      scheduler.stop()

      scheduler.schedule(1 as Numeric<'s'>, (time) => calls.push(time))
      scheduler.flush()

      assert.deepStrictEqual(calls, [])
    })
  })
})
