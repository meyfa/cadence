import eslintConfig from '@meyfa/eslint-config'

export default [
  ...eslintConfig,
  {
    ignores: ['dist']
  },
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.lint.json'
      }
    }
  }
]
