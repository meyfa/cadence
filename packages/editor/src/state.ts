import type { Numeric, Unit } from '@core/program.js'

export interface Settings {
  readonly outputGain: Numeric<'db'>
}

export interface CadenceEditorState {
  readonly settings: Settings
  readonly code: string
}

export interface PartialCadenceEditorState {
  readonly settings?: Partial<Settings>
  readonly code?: string
}

export function serializeEditorState (state: CadenceEditorState): string {
  return JSON.stringify(state)
}

export function parseEditorState (input: string): PartialCadenceEditorState {
  const data = tryJSONParse(input)

  if (typeof data !== 'object' || data == null) {
    return {}
  }

  const code = 'code' in data ? parseString(data.code) : undefined

  const settingsObj = 'settings' in data && typeof data.settings === 'object' && data.settings != null
    ? data.settings
    : {}

  const outputGain = 'outputGain' in settingsObj
    ? parseNumeric('db', settingsObj.outputGain)
    : undefined

  return {
    code,
    settings: {
      outputGain
    }
  }
}

function tryJSONParse (input: string): unknown {
  try {
    return JSON.parse(input)
  } catch {
    return undefined
  }
}

function parseString (value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function parseNumeric<const U extends Unit> (unit: U, value: unknown): Numeric<U> | undefined {
  if (value == null || typeof value !== 'object') {
    return undefined
  }

  if (!('unit' in value) || value.unit !== unit) {
    return undefined
  }

  if (!('value' in value) || typeof value.value !== 'number') {
    return undefined
  }

  return { unit, value: value.value }
}
