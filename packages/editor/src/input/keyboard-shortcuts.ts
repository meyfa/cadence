const KEY_CTRL = 'Ctrl'
const KEY_SHIFT = 'Shift'
const KEY_ALT = 'Alt'

const KEY_SEPARATOR = '+'

export const modifierKeys = [
  KEY_CTRL,
  KEY_SHIFT,
  KEY_ALT
] as const

export const alphabetKeys = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W',
  'X', 'Y', 'Z'
] as const

export const digitKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

export const alphanumericKeys = [...alphabetKeys, ...digitKeys] as const

export const specialKeys = [
  'Space', 'Enter', 'Escape', 'Backspace', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Delete', 'Home', 'End', 'PageUp', 'PageDown', 'Insert'
] as const

export const functionKeys = [
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
] as const

export type ModifierKey = typeof modifierKeys[number]
export type AlphabetKey = typeof alphabetKeys[number]
export type DigitKey = typeof digitKeys[number]
export type AlphanumericKey = typeof alphanumericKeys[number]
export type SpecialKey = typeof specialKeys[number]
export type FunctionKey = typeof functionKeys[number]

export type NonModifierKey = AlphanumericKey | SpecialKey | FunctionKey
export type AllKeys = ModifierKey | NonModifierKey

type Sep = typeof KEY_SEPARATOR

export type KeyboardShortcut =
  NonModifierKey |
  `${ModifierKey}${Sep}${NonModifierKey}` |
  `${ModifierKey}${Sep}${ModifierKey}${Sep}${NonModifierKey}` |
  `${ModifierKey}${Sep}${ModifierKey}${Sep}${ModifierKey}${Sep}${NonModifierKey}`

export interface KeyboardShortcutDetails {
  readonly ctrl?: boolean
  readonly shift?: boolean
  readonly alt?: boolean
  readonly code: string
}

export function convertCodeToKey (code: string): string {
  // "KeyA" -> "A"
  if (code.startsWith('Key')) {
    return code.slice(3)
  }

  // "Digit0" -> "0"
  if (code.startsWith('Digit')) {
    return code.slice(5)
  }

  return code
}

export function parseKeyboardShortcut (shortcut: KeyboardShortcut): [...ModifierKey[], NonModifierKey] {
  return shortcut.split(KEY_SEPARATOR) as [...ModifierKey[], NonModifierKey]
}

function joinKeyboardShortcut (
  modifiers: Readonly<{ ctrl?: boolean, shift?: boolean, alt?: boolean }>,
  mainKey: NonModifierKey
): KeyboardShortcut {
  const parts: string[] = []

  if (modifiers.ctrl === true) {
    parts.push(KEY_CTRL)
  }
  if (modifiers.shift === true) {
    parts.push(KEY_SHIFT)
  }
  if (modifiers.alt === true) {
    parts.push(KEY_ALT)
  }

  parts.push(mainKey)

  return parts.join(KEY_SEPARATOR) as KeyboardShortcut
}

export function serializeKeyboardShortcut (details: KeyboardShortcutDetails): KeyboardShortcut {
  const mainKey = convertCodeToKey(details.code) as NonModifierKey
  return joinKeyboardShortcut(details, mainKey)
}

export function normalizeKeyboardShortcut (shortcut: KeyboardShortcut): KeyboardShortcut {
  const parsedParts = parseKeyboardShortcut(shortcut)
  const modifiers = parsedParts.slice(0, -1)
  const mainKey = parsedParts.at(-1) as NonModifierKey

  const modifierFlags = {
    ctrl: modifiers.includes(KEY_CTRL),
    shift: modifiers.includes(KEY_SHIFT),
    alt: modifiers.includes(KEY_ALT)
  }

  return joinKeyboardShortcut(modifierFlags, mainKey)
}

export function isFunctionKey (key: string): key is FunctionKey {
  return functionKeys.includes(key as FunctionKey)
}

export function hasModifierKey (shortcut: KeyboardShortcut): boolean {
  return shortcut.includes(KEY_SEPARATOR)
}
