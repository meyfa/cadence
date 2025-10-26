export function parseJSON (data: string, fallback: unknown = undefined): unknown {
  try {
    return JSON.parse(data)
  } catch {
    return fallback
  }
}

export function serializeJSON (data: unknown): string {
  return JSON.stringify(data)
}
