import { parser } from './cadence.grammar'
import { foldNodeProp, foldInside, LRLanguage, LanguageSupport } from '@codemirror/language'
import { styleTags, tags as t } from '@lezer/highlight'

const parserWithMetadata = parser.configure({
  props: [
    styleTags({
      Comment: t.comment,

      NumberLiteral: t.number,
      StringLiteral: t.string,
      PatternLiteral: t.string,

      '=': t.definitionOperator,
      ':': t.separator,
      '{ }': t.brace,
      '( )': t.paren,
      ',': t.separator,

      '<<': t.operator,

      BlockName: t.keyword,
      AssignmentName: t.definition(t.variableName),
      VariableReference: t.variableName,
      Callee: t.function(t.name),
      RoutingTarget: t.variableName
    }),

    foldNodeProp.add({
      Block: foldInside
    })
  ]
})

export const cadenceLanguage = LRLanguage.define({
  parser: parserWithMetadata,
  languageData: {
    commentTokens: {
      line: '#'
    }
  }
})

export function cadenceLanguageSupport (): LanguageSupport {
  return new LanguageSupport(cadenceLanguage)
}
