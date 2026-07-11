export function dbToGain (db: number): number {
  if (Number.isNaN(db) || (db > 0 && !Number.isFinite(db))) {
    throw new Error(`Invalid gain: ${db}`)
  }

  return Math.pow(10, db / 20)
}

export function gainToDb (gain: number): number {
  if (gain <= 0) {
    return -Infinity
  }

  return 20 * Math.log10(gain)
}
