import { describe, it } from 'node:test'
import { convertCodeToKey, hasModifierKey, isFunctionKey, normalizeKeyboardShortcut, parseKeyboardShortcut, serializeKeyboardShortcut, type KeyboardShortcut, type KeyboardShortcutDetails } from '../../editor/src/keyboard-shortcuts.js'
import assert from 'node:assert'

describe('keyboard-shortcuts.ts', () => {
  describe('convertCodeToKey', () => {
    it('should convert key codes to keys correctly', () => {
      const testCases: ReadonlyArray<{ input: string, expected: string }> = [
        { input: 'KeyA', expected: 'A' },
        { input: 'KeyZ', expected: 'Z' },
        { input: 'Digit0', expected: '0' },
        { input: 'Digit9', expected: '9' },
        { input: 'ArrowUp', expected: 'ArrowUp' },
        { input: 'Space', expected: 'Space' },
        { input: 'F1', expected: 'F1' },
        { input: 'F12', expected: 'F12' }
      ]

      for (const { input, expected } of testCases) {
        const result = convertCodeToKey(input)
        assert.strictEqual(result, expected, `convertCodeToKey(${JSON.stringify(input)}) should be ${JSON.stringify(expected)}, got ${JSON.stringify(result)}`)
      }
    })
  })

  describe('parseKeyboardShortcut', () => {
    it('should split keyboard shortcuts into modifier keys and main key', () => {
      const testCases: ReadonlyArray<{ input: KeyboardShortcut, expected: string[] }> = [
        { input: 'A', expected: ['A'] },
        { input: 'Ctrl+A', expected: ['Ctrl', 'A'] },
        { input: 'Ctrl+Shift+A', expected: ['Ctrl', 'Shift', 'A'] },
        { input: 'Ctrl+Shift+Alt+A', expected: ['Ctrl', 'Shift', 'Alt', 'A'] },
        { input: 'Space', expected: ['Space'] },
        { input: 'Ctrl+Space', expected: ['Ctrl', 'Space'] }
      ]

      for (const { input, expected } of testCases) {
        const result = parseKeyboardShortcut(input)
        assert.deepStrictEqual(result, expected, `parseKeyboardShortcut(${JSON.stringify(input)}) should be ${JSON.stringify(expected)}, got ${JSON.stringify(result)}`)
      }
    })
  })

  describe('serializeKeyboardShortcut', () => {
    it('should serialize keyboard shortcut details into string representation', () => {
      const testCases: ReadonlyArray<{ input: KeyboardShortcutDetails, expected: KeyboardShortcut }> = [
        { input: { code: 'KeyA' }, expected: 'A' },
        { input: { ctrl: true, code: 'KeyA' }, expected: 'Ctrl+A' },
        { input: { ctrl: true, shift: true, code: 'KeyA' }, expected: 'Ctrl+Shift+A' },
        { input: { ctrl: true, shift: true, alt: true, code: 'KeyA' }, expected: 'Ctrl+Shift+Alt+A' },
        { input: { code: 'Space' }, expected: 'Space' },
        { input: { ctrl: true, code: 'Space' }, expected: 'Ctrl+Space' }
      ]

      for (const { input, expected } of testCases) {
        const result = serializeKeyboardShortcut(input)
        assert.strictEqual(result, expected, `serializeKeyboardShortcut(${JSON.stringify(input)}) should be ${JSON.stringify(expected)}, got ${JSON.stringify(result)}`)
      }
    })
  })

  describe('normalizeKeyboardShortcut', () => {
    it('should normalize keyboard shortcut strings', () => {
      const testCases: ReadonlyArray<{ input: KeyboardShortcut, expected: KeyboardShortcut }> = [
        { input: 'A', expected: 'A' },
        { input: 'Ctrl+A', expected: 'Ctrl+A' },
        { input: 'Ctrl+Ctrl+A', expected: 'Ctrl+A' },
        { input: 'Shift+Ctrl+A', expected: 'Ctrl+Shift+A' },
        { input: 'Shift+Ctrl+Shift+A', expected: 'Ctrl+Shift+A' },
        { input: 'Alt+Shift+Ctrl+A', expected: 'Ctrl+Shift+Alt+A' }
      ]

      for (const { input, expected } of testCases) {
        const result = normalizeKeyboardShortcut(input)
        assert.strictEqual(result, expected, `normalizeKeyboardShortcut(${JSON.stringify(input)}) should be ${JSON.stringify(expected)}, got ${JSON.stringify(result)}`)
      }
    })
  })

  describe('isFunctionKey', () => {
    it('should identify function keys correctly', () => {
      assert.strictEqual(isFunctionKey('F1'), true)
      assert.strictEqual(isFunctionKey('F12'), true)
      assert.strictEqual(isFunctionKey('A'), false)
      assert.strictEqual(isFunctionKey('Space'), false)
    })
  })

  describe('hasModifierKey', () => {
    it('should detect presence of modifier keys in keyboard shortcuts', () => {
      assert.strictEqual(hasModifierKey('A'), false)
      assert.strictEqual(hasModifierKey('Space'), false)
      assert.strictEqual(hasModifierKey('Ctrl+A'), true)
      assert.strictEqual(hasModifierKey('Ctrl+Shift+A'), true)
      assert.strictEqual(hasModifierKey('Alt+Space'), true)
      assert.strictEqual(hasModifierKey('Shift+Space'), true)
    })
  })
})
