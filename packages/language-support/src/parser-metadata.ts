import { foldInside, foldNodeProp } from '@codemirror/language'
import { styleTags, tags as t } from '@lezer/highlight'
import type { ParserConfig } from '@lezer/lr'

export const cadenceParserConfig: ParserConfig = {
  props: [
    styleTags({
      Comment: t.comment,

      Number: t.number,
      String: t.string,
      Pattern: t.special(t.string),
      CurveType: t.function(t.name),

      keyword: t.keyword,
      unit: t.number,

      UseAlias: t.definition(t.variableName),
      'UseAlias "*"': t.keyword,

      '{ }': t.brace,
      '( )': t.paren,
      ',': t.separator,

      '=': t.definitionOperator,
      ':': t.separator,
      '<<': t.operator,

      '+ - "*" "/"': t.arithmeticOperator,

      VariableDefinition: t.definition(t.variableName),
      VariableName: t.variableName,

      PropertyName: t.definition(t.propertyName),
      MemberAccess: t.propertyName,

      Callee: t.function(t.name)
    }),

    foldNodeProp.add({
      Block: foldInside
    })
  ]
}
