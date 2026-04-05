import type { DockLayout } from '@editor'
import { optional, string, type, type Struct } from 'superstruct'
import { dockLayoutSchema } from './layout.js'
import { partialSettingsSchema, type Settings } from './settings.js'
import type { StructValidation } from './validation.js'

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
  return serializeJSON(state)
}

export function parseEditorState (input: string): PartialCadenceEditorState {
  const data = parseJSON(input)
  const [, state] = validatePartialEditorState(data)

  return state ?? {}
}

const partialEditorStateSchema: Struct<PartialCadenceEditorState> = type({
  settings: optional(partialSettingsSchema),
  layout: optional(dockLayoutSchema),
  code: optional(string())
})

function validatePartialEditorState (data: unknown): StructValidation<PartialCadenceEditorState> {
  return partialEditorStateSchema.validate(data, { coerce: true })
}

function parseJSON (data: string, fallback: unknown = undefined): unknown {
  try {
    return JSON.parse(data)
  } catch {
    return fallback
  }
}

function serializeJSON (data: unknown): string {
  return JSON.stringify(data)
}
