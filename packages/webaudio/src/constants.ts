export const DEFAULT_ROOT_NOTE = 'C5' as const

export function dbToGain (db: number): number {
  return Math.pow(10, db / 20)
}
