export interface MeterConfiguration {
  /**
   * The interval, in frames, at which the meter should post updates.
   */
  readonly interval: number
}

export interface TimeMeasurement {
  /**
   * The current time measurement, in seconds.
   */
  readonly time: number
}
