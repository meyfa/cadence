export interface GenerateOptions {
  readonly beatsPerBar: number

  readonly tempo: {
    readonly default: number
    readonly minimum: number
    readonly maximum: number
  }
}
