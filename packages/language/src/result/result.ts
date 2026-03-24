export interface ErrorResult<TError> {
  readonly complete: false
  readonly error: TError
}

export interface SuccessResult<TValue> {
  readonly complete: true
  readonly value: TValue
}

export type Result<TValue, TError> = SuccessResult<TValue> | ErrorResult<TError>
