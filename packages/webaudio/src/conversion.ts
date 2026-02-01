export function dbToGain (db: number): number {
  return Math.pow(10, db / 20)
}
