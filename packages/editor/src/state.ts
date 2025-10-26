import type { Numeric, Unit } from '@core/program.js'
import type { DockLayout } from './layout.js'

export type ThemeSetting = 'dark' | 'light' | 'system'

export interface Settings {
  readonly theme: ThemeSetting
  readonly outputGain: Numeric<'db'>
}

export interface CadenceEditorState {
  readonly settings: Settings
  readonly layout: DockLayout
  readonly code: string
}

export interface PartialCadenceEditorState {
  readonly settings?: Partial<Settings>
  readonly layout?: DockLayout
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

  // settings
  const settingsObj = 'settings' in data && typeof data.settings === 'object' && data.settings != null
    ? data.settings
    : {}

  const theme = 'theme' in settingsObj && (settingsObj.theme === 'dark' || settingsObj.theme === 'light' || settingsObj.theme === 'system')
    ? settingsObj.theme
    : undefined

  const outputGain = 'outputGain' in settingsObj
    ? parseNumeric('db', settingsObj.outputGain)
    : undefined

  // layout
  // TODO validate layout structure
  const layout = 'layout' in data && typeof data.layout === 'object' && data.layout != null
    ? data.layout as DockLayout
    : undefined

  // code
  const code = 'code' in data ? parseString(data.code) : undefined

  return {
    settings: {
      theme,
      outputGain
    },
    layout,
    code
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
