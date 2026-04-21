import { LanguageSupport, LRLanguage } from '@codemirror/language'
import { parser } from './cadence.grammar'
import { cadenceParserConfig } from './parser-metadata.js'

const parserWithMetadata = parser.configure(cadenceParserConfig)

const cadenceLanguage = LRLanguage.define({
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
