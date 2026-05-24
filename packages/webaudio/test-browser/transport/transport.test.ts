import { numeric } from '@utility'
import { describe, expect, it } from 'vitest'
import { createOfflineTransport } from '../../src/transport/transport.js'

describe('transport/transport.ts', () => {
  describe('createOfflineTransport', () => {
    it('uses the immediate scheduler during offline rendering', async () => {
      const transport = createOfflineTransport({
        duration: numeric('s', 3),
        channels: 2,
        sampleRate: 44_100
      })

      const calls: number[] = []
      transport.schedule(2, (time) => calls.push(time))
      transport.schedule(1, (time) => calls.push(time))

      const buffer = await transport.render()

      expect(calls).toEqual([1, 2])
      expect(buffer.length).toBe(132_300)
      expect(buffer.numberOfChannels).toBe(2)
      expect(buffer.sampleRate).toBe(44_100)
    })

    it('tracks time during offline rendering', async () => {
      const transport = createOfflineTransport({
        duration: numeric('s', 3),
        channels: 2,
        sampleRate: 44_100
      })

      await transport.render()
      const trackedTime = transport.time.get()

      expect(trackedTime).toBeDefined()
      expect(trackedTime?.unit).toBe('s')

      // 2 significant digits: 128 frames (one quantum) at 44.1kHz is approximately 2.9ms
      expect(trackedTime?.value).toBeCloseTo(3, 2)
    })
  })
})
