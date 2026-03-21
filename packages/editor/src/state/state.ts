import { optional, string, type, type Struct } from 'superstruct'
import { parseJSON, serializeJSON } from '../utilities/json.js'
import type { StructValidation } from '../utilities/validation.js'
import { dockLayoutSchema, type DockLayout } from './layout.js'
import { partialSettingsSchema, type Settings } from './settings.js'

// Types

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

// Schema

const partialEditorStateSchema: Struct<PartialCadenceEditorState> = type({
  settings: optional(partialSettingsSchema),
  layout: optional(dockLayoutSchema),
  code: optional(string())
})

// Validation

function validatePartialEditorState (data: unknown): StructValidation<PartialCadenceEditorState> {
  return partialEditorStateSchema.validate(data, { coerce: true })
}

// Public API

export function serializeEditorState (state: CadenceEditorState): string {
  return serializeJSON(state)
}

export function parseEditorState (input: string): PartialCadenceEditorState {
  const data = parseJSON(input)
  const [, state] = validatePartialEditorState(data)

  return state ?? {}
}
