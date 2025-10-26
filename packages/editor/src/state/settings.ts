import type { Numeric } from '@core/program.js'
import { numeric, type StructValidation } from '@editor/utilities/validation.js'
import { enums, optional, type, type Struct } from 'superstruct'

// Types

export type ThemeSetting = 'dark' | 'light' | 'system'

export interface Settings {
  readonly theme: ThemeSetting
  readonly outputGain: Numeric<'db'>
}

// Schema

const themeSetting: Struct<ThemeSetting> = enums(['dark', 'light', 'system'])

export const partialSettingsSchema: Struct<Partial<Settings>> = type({
  theme: optional(themeSetting),
  outputGain: optional(numeric('db'))
})

// Validation

export function validatePartialSettings (data: unknown): StructValidation<Partial<Settings>> {
  return partialSettingsSchema.validate(data, { coerce: true })
}
