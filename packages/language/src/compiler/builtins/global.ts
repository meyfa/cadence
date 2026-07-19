import type { ParameterError } from '../../type-system/base/function.ts'
import { AutomationFacet } from '../../type-system/domain/automation.ts'
import { CurveFacet } from '../../type-system/domain/curve.ts'
import { ParameterFacet } from '../../type-system/domain/parameter.ts'
import { Functions } from '../../type-system/helpers.ts'
import { makeSchema } from '../../type-system/schema.ts'
import type { FacetType, Value } from '../../type-system/types.ts'

const automate = Functions.of({
  summary: 'Automates a parameter with a curve over time.',

  parameters: makeSchema([
    { name: 'target', type: ParameterFacet.type(), required: true },
    { name: 'curve', type: CurveFacet.type(), required: true }
  ]),

  returnType: AutomationFacet.type(),

  effects: { blocking: false },

  check: (args: ReadonlyMap<string, FacetType>) => {
    const errors: ParameterError[] = []

    const targetType = args.get('target')
    const curveType = args.get('curve')

    if (targetType == null || curveType == null) {
      return errors
    }

    const targetUnit = ParameterFacet.detail(targetType)
    const curveUnit = CurveFacet.detail(curveType)

    if (targetUnit !== curveUnit) {
      errors.push({
        parameter: 'curve',
        message: `Expected type ${CurveFacet.with(targetUnit).format()} for argument "curve", got ${curveType.format()}`
      })
    }

    return errors
  },

  invoke: (_context, { target, curve }) => {
    const targetValue = ParameterFacet.get(target)
    const curveValue = CurveFacet.get(curve)

    return AutomationFacet.type().of({
      parameterId: targetValue.id,
      curve: curveValue
    })
  }
})

export const globalBuiltins: ReadonlyMap<string, Value> = new Map([
  ['automate', automate]
])
