export function dbToGain (db: number): number {
  if (Number.isNaN(db) || (db > 0 && !Number.isFinite(db))) {
    throw new Error(`Invalid gain: ${db}`)
  }

  return Math.pow(10, db / 20)
}
