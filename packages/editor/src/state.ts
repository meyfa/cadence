export interface Settings {
  readonly volume: number
}

export interface CadenceEditorState {
  readonly settings: Settings
  readonly code: string
}

export function serializeEditorState (state: CadenceEditorState): string {
  return JSON.stringify(state)
}

export function parseEditorState (data: string): CadenceEditorState | undefined {
  try {
    const obj = JSON.parse(data)
    if (typeof obj !== 'object' || obj == null) {
      return undefined
    }

    if (typeof obj.code !== 'string') {
      return undefined
    }

    if (typeof obj.settings !== 'object' || obj.settings == null) {
      return undefined
    }

    if (typeof obj.settings.volume !== 'number') {
      return undefined
    }

    return {
      code: obj.code,
      settings: {
        volume: obj.settings.volume
      }
    }
  } catch {
    return undefined
  }
}
