import type { SourceRange } from '@meyfa/cadence-ast'
import { computeTypeUnion, getPossibleTypeAtoms } from '../../../type-system/transforms.ts'
import type { FacetType, Type } from '../../../type-system/types.ts'
import { CompileError } from '../../error.ts'
import { mergeCapabilities, noCapabilities } from '../capabilities.ts'
import type { Checked } from './types.ts'

export function expectType (expected: Pick<Type, 'is' | 'format'>, actual: Type, range?: SourceRange): readonly CompileError[] {
  if (!expected.is(actual)) {
    return [
      new CompileError(`Expected type ${expected.format()}, got ${actual.format()}`, range)
    ]
  }

  return []
}

// TODO: De-duplicate this function with the one in operators/lifting.ts
export function liftOverFacetType (
  type: Type,
  check: (facetType: FacetType) => Checked<Type>
): Checked<Type> {
  const errors: CompileError[] = []
  let capabilities = noCapabilities

  const atoms = getPossibleTypeAtoms(type)
  const resultTypes: Type[] = []

  for (const atom of atoms) {
    const checkResult = check(atom)
    errors.push(...checkResult.errors)
    capabilities = mergeCapabilities(capabilities, checkResult.capabilities)

    if (checkResult.result != null) {
      resultTypes.push(checkResult.result)
    }
  }

  // If any of the atoms failed to produce a result, we cannot determine a useful
  // result type for the union.
  if (resultTypes.length < atoms.length) {
    return { errors, capabilities }
  }

  const result = computeTypeUnion(resultTypes)

  return { errors, capabilities, result }
}
