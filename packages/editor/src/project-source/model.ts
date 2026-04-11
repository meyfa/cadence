export interface ProjectSource {
  readonly files: Readonly<Record<string, string>>
}

export function createProjectSourceState (files: Readonly<Record<string, string>> = {}): ProjectSource {
  return {
    files
  }
}

export function getProjectFileContent (state: ProjectSource, path: string): string | undefined {
  return state.files[path]
}

export function setProjectFileContent (state: ProjectSource, path: string, content: string): ProjectSource {
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
