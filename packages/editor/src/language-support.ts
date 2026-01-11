import { foldInside, foldNodeProp, LanguageSupport, LRLanguage } from '@codemirror/language'
import { keywords } from '@language/constants.js'
import { styleTags, tags as t } from '@lezer/highlight'
import { parser } from './cadence.grammar'

const parserWithMetadata = parser.configure({
  props: [
    styleTags({
      Comment: t.comment,

      Number: t.number,
      String: t.string,
      Pattern: t.string,

      '{ }': t.brace,
      '( )': t.paren,
      ',': t.separator,

      '=': t.definitionOperator,
      ':': t.separator,
      '<<': t.operator,

      '+ - "*" "/"': t.arithmeticOperator,

      [keywords.join(' ')]: t.keyword,

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
      line: '//'
    }
  }
})

export function cadenceLanguageSupport (): LanguageSupport {
  return new LanguageSupport(cadenceLanguage)
}
