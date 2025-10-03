import { defineConfig } from 'eslint/config'
import eslintConfig from '@meyfa/eslint-config'
import pluginReact from 'eslint-plugin-react'
import pluginReactHooks from 'eslint-plugin-react-hooks'
import { fixupConfigRules, fixupPluginRules } from '@eslint/compat'

export default defineConfig([
  ...eslintConfig,
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat['jsx-runtime'],
  {
    ignores: ['dist']
  },
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.lint.json'
      }
    }
  },
  {
    plugins: {
      'react-hooks': fixupPluginRules(pluginReactHooks)
    },

    settings: {
      react: {
        version: 'detect'
      }
    },

    rules: {
      // @ts-expect-error eslint-plugin-react-hooks is improperly typed
      ...fixupConfigRules(pluginReactHooks.configs.recommended).rules,

      'react/no-typos': ['error'],
      'react/style-prop-object': ['warn'],
      'react/jsx-pascal-case': ['warn', {
        allowAllCaps: true,
        ignore: []
      }],

      '@stylistic/jsx-quotes': ['error', 'prefer-single'],
      '@stylistic/jsx-first-prop-new-line': 'error',
      '@stylistic/jsx-max-props-per-line': ['error', { when: 'multiline' }],
      '@stylistic/jsx-closing-bracket-location': ['error'],

      'react/void-dom-elements-no-children': ['error'],
      'react/no-unstable-nested-components': ['error'],
      'react/prop-types': ['error', {
        ignore: ['children']
      }],

      // disable in favor of @stylistic
      'react/jsx-indent': 'off',
      'react/jsx-indent-props': 'off',
      'react/jsx-first-prop-new-line': 'off',
      'react/jsx-max-props-per-line': 'off',
      'react/jsx-props-no-multi-spaces': 'off',
      'react/jsx-tag-spacing': 'off',
      'react/jsx-wrap-multilines': 'off'
    }
  }
])
