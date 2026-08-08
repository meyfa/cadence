import type { Capabilities } from '../../type-system/base/function.ts'

export const noCapabilities: Capabilities = { mayBlock: false }

export function mergeCapabilities (target: Capabilities, source: Capabilities): Capabilities {
  return {
    mayBlock: target.mayBlock || source.mayBlock
  }
}
