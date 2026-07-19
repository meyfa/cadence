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

      '&': t.operator,

      VariableDefinition: t.definition(t.variableName),
      VariableName: t.variableName,

      ArgumentName: t.definition(t.propertyName),
      Member: t.propertyName,

      Callee: t.function(t.name)
    }),

    foldNodeProp.add({
      Block: foldInside
    })
  ]
}
