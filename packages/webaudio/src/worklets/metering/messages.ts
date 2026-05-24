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

export interface GainMeasurement {
  /**
   * The signal's peak values for the left and right channels, each representing the
   * maximum absolute amplitude over the interval since the last update, in the range [0, 1].
   */
  readonly peak: readonly [number, number]

  /**
   * The signal's root mean square (RMS) values for the left and right channels, each
   * representing the average power over the interval since the last update, in the range [0, 1].
   */
  readonly rms: readonly [number, number]
}
