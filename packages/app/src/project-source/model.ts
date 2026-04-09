export const TRACK_FILE_PATH = 'track.cadence'

export interface ProjectSourceState {
  readonly files: Readonly<Record<string, string>>
}

export function createProjectSourceState (entrypointContent = ''): ProjectSourceState {
  return {
    files: {
      [TRACK_FILE_PATH]: entrypointContent
    }
  }
}

export function getProjectFileContent (state: ProjectSourceState, path: string): string | undefined {
  return state.files[path]
}

export function setProjectFileContent (state: ProjectSourceState, path: string, content: string): ProjectSourceState {
  if (state.files[path] === content) {
    return state
  }

  return {
    ...state,
    files: {
      ...state.files,
      [path]: content
    }
  }
}
