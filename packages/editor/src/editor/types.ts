import type { Transaction, TransactionSpec } from '@codemirror/state'

export interface EditorLocation {
  readonly line: number
  readonly column: number
}

export type EditorViewDispatch = ((transaction: Transaction) => void) & ((...specs: TransactionSpec[]) => void)
