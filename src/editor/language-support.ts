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

      '{ }': t.brace,
      '( )': t.paren,
      ',': t.separator,

      '=': t.definitionOperator,
      ':': t.separator,
      '<<': t.operator,

      '+ - "*" "/"': t.arithmeticOperator,

      'track section for mixer bus': t.keyword,

      VariableDefinition: t.definition(t.variableName),
      VariableName: t.variableName,

      Callee: t.function(t.name)
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
