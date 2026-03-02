export type Unit = undefined | 'bpm' | 'beats' | 's' | 'hz' | 'db'

export interface Numeric<U extends Unit> {
  readonly unit: U
  readonly value: number
}

export function numeric<U extends Unit> (unit: U, value: number): Numeric<U> {
  return { unit, value }
}
