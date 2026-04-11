export function average (values: Float32Array, start: number, end: number): number {
  let sum = 0

  for (let i = start; i < end; ++i) {
    sum += values[i]
  }

  return sum / (end - start)
}
