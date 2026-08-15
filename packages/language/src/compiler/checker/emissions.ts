import type { SourceRange } from '@meyfa/cadence-ast'
import type { Brand } from '@meyfa/cadence-utility'
import type { Result } from '../../result/result.ts'
import type { FacetType, Type } from '../../type-system/types.ts'
import { assert } from '../assert.ts'
import { CompileError } from '../error.ts'

export type SlotName = Brand<string, 'language.SlotName'>

export type Slots = readonly Slot[]

export interface Slot {
  /**
   * The name of the slot.
   */
  readonly name: SlotName

  /**
   * The type of value that is expected to be emitted into this slot, or 'infer' if the type
   * should be inferred from the values that are emitted into the slot.
   */
  readonly type: Type | 'infer'

  /**
   * Whether this slot is required to be emitted into at least once (default false).
   */
  readonly required?: boolean

  /**
   * Whether this slot is allowed to be emitted into more than once (default false).
   */
  readonly singular?: boolean
}

export type Emissions = ReadonlyMap<SlotName, Emission>
export type MutableEmissions = Map<SlotName, Emission>

export interface Emission {
  /**
   * The slot into which the values are emitted.
   */
  readonly slot: Slot

  /**
   * For inferred slots, the type of the emitted value. For typed slots, this field is absent.
   */
  readonly type?: FacetType

  /**
   * The minimum amount of emissions into the slot over all conditional branches.
   */
  readonly minimum: number

  /**
   * The maximum amount of emissions into the slot over all conditional branches.
   */
  readonly maximum: number

  /**
   * The source ranges of the emitted value.
   */
  readonly ranges: readonly SourceRange[]
}

export function addEmission (target: MutableEmissions, emission: Emission): readonly CompileError[] {
  const errors: CompileError[] = []

  const existing = target.get(emission.slot.name)
  if (existing == null) {
    target.set(emission.slot.name, emission)
    return errors
  }

  assert(existing.slot.type === emission.slot.type, `Slot "${existing.slot.name}" type mismatch when merging emissions`)

  let type: FacetType | undefined

  if (existing.slot.type === 'infer') {
    const intersection = intersectTypes(existing, emission)
    if (!intersection.complete) {
      errors.push(intersection.error)
      return errors
    }

    type = intersection.value
  }

  target.set(emission.slot.name, {
    slot: existing.slot,
    type,
    minimum: existing.minimum + emission.minimum,
    maximum: existing.maximum + emission.maximum,
    ranges: [...existing.ranges, ...emission.ranges]
  })

  return errors
}

export function validateEmissions (emissions: Emissions, slots: Slots, range: SourceRange): readonly CompileError[] {
  const errors: CompileError[] = []

  for (const slot of slots) {
    const emitted = emissions.get(slot.name)

    if (slot.required && (emitted == null || emitted.minimum < 1)) {
      const message = slot.type === 'infer'
        ? `Expected at least one emission into slot "${slot.name}"`
        : `Expected at least one emission into slot "${slot.name}" of type ${slot.type.format()}`
      errors.push(new CompileError(message, range))
    }

    if (slot.singular && emitted != null && emitted.maximum > 1) {
      const message = slot.type === 'infer'
        ? `Duplicate emission into slot "${slot.name}" which accepts at most one value`
        : `Duplicate emission into slot "${slot.name}" of type ${slot.type.format()} which accepts at most one value`
      errors.push(new CompileError(message, range))
    }
  }

  return errors
}

function intersectTypes (existing: Emission, emission: Emission): Result<FacetType | undefined, CompileError> {
  if (existing.type == null || emission.type == null) {
    return { complete: true, value: existing.type ?? emission.type }
  }

  const intersection = existing.type.intersect(emission.type)
  if (intersection == null) {
    const types = [existing.type.format(), emission.type.format()].join(', ')
    const message = `Incompatible types for slot "${emission.slot.name}": ${types}`
    return { complete: false, error: new CompileError(message, emission.ranges[0]) }
  }

  return { complete: true, value: intersection }
}
