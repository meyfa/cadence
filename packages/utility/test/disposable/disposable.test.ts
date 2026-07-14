import assert from 'node:assert'
import { describe, it } from 'node:test'
import { DisposeStack } from '../../src/disposable/disposable.ts'

describe('disposable/disposable.ts', () => {
  describe('DisposeStack', () => {
    it('should call dispose functions in reverse order', () => {
      const disposeStack = new DisposeStack()
      const calls: number[] = []

      disposeStack.push(() => calls.push(1))
      disposeStack.push(() => calls.push(2))
      disposeStack.push(() => calls.push(3))

      disposeStack.dispose()

      assert.deepStrictEqual(calls, [3, 2, 1])
    })

    it('should clear the stack after disposing', () => {
      const disposeStack = new DisposeStack()
      let callCount = 0

      disposeStack.push(() => callCount++)
      disposeStack.dispose()
      disposeStack.dispose()

      assert.strictEqual(callCount, 1)
    })

    it('should allow pushing disposables', () => {
      const disposeStack = new DisposeStack()
      const calls: number[] = []

      disposeStack.pushDisposable({
        dispose: () => calls.push(1)
      })

      disposeStack.pushDisposable({
        dispose: () => calls.push(2)
      })

      disposeStack.dispose()

      assert.deepStrictEqual(calls, [2, 1])
    })

    it('should set the correct this context for disposables', () => {
      const disposeStack = new DisposeStack()
      const calls: number[] = []

      const a = {
        value: 1,
        dispose () {
          calls.push(this.value)
        }
      }
      disposeStack.pushDisposable(a)

      const b = {
        value: 2,
        dispose () {
          calls.push(this.value)
        }
      }
      disposeStack.pushDisposable(b)

      disposeStack.dispose()

      assert.deepStrictEqual(calls, [2, 1])
    })

    it('should call dispose functions added during disposal', () => {
      const disposeStack = new DisposeStack()
      const calls: number[] = []

      disposeStack.push(() => {
        calls.push(1)
        disposeStack.push(() => calls.push(2))
      })
      disposeStack.push(() => calls.push(3))

      disposeStack.dispose()

      assert.deepStrictEqual(calls, [3, 1, 2])
    })

    it('should immediately dispose disposables added after disposal', () => {
      const disposeStack = new DisposeStack()
      const calls: number[] = []

      disposeStack.push(() => calls.push(1))
      disposeStack.dispose()

      disposeStack.push(() => calls.push(2))
      assert.deepStrictEqual(calls, [1, 2])

      disposeStack.pushDisposable({
        dispose () {
          calls.push(3)
        }
      })
      assert.deepStrictEqual(calls, [1, 2, 3])
    })

    it('should ignore reentrant dispose() calls', () => {
      const disposeStack = new DisposeStack()
      const calls: string[] = []

      disposeStack.push(() => calls.push('first'))
      disposeStack.push(() => {
        calls.push('second:start')
        disposeStack.dispose()
        calls.push('second:end')
      })

      disposeStack.dispose()

      assert.deepStrictEqual(calls, ['second:start', 'second:end', 'first'])
    })
  })
})
