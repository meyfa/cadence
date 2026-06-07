interface Scope<T> {
  readonly parent?: Scope<T>
  readonly resolutions: ReadonlyMap<string, T>
}

export function resolveInScope<T> (scope: Scope<T>, name: string): T | undefined {
  let current: Scope<T> | undefined = scope

  while (current != null) {
    const result = current.resolutions.get(name)
    if (result != null) {
      return result
    }
    current = current.parent
  }

  return undefined
}
