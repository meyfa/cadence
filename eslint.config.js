import { fixupConfigRules, fixupPluginRules } from '@eslint/compat'
import eslintConfig from '@meyfa/eslint-config'
import pluginReact from 'eslint-plugin-react'
import pluginReactHooks from 'eslint-plugin-react-hooks'
import { defineConfig } from 'eslint/config'
import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const packages = [
  {
    name: 'collections',
    dependencies: []
  },
  {
    name: 'flowchart',
    dependencies: [
      'collections'
    ]
  },
  {
    name: 'core',
    dependencies: []
  },
  {
    name: 'ast',
    dependencies: [
      'core'
    ]
  },
  {
    name: 'codecs',
    dependencies: [
      'core'
    ]
  },
  {
    name: 'webaudio',
    dependencies: [
      'collections',
      'core'
    ]
  },
  {
    name: 'language',
    dependencies: [
      'collections',
      'core',
      'ast'
    ]
  },
  {
    name: 'editor',
    dependencies: [
      'collections',
      'flowchart',
      'core',
      'ast',
      'language'
    ]
  },
  {
    name: 'app',
    dependencies: [
      'collections',
      'flowchart',
      'core',
      'codecs',
      'webaudio',
      'language',
      'editor'
    ],
    anonymous: true // not exposed via "@app"
  }
]

// Ensure that the above list is synced with the TSConfig
const tsconfigPath = path.resolve(import.meta.dirname, './tsconfig.base.json')
const tsconfig = JSON.parse(await readFile(tsconfigPath, 'utf-8'))
const tsconfigPackages = Object.keys(tsconfig.compilerOptions.paths).map((key) => {
  return key.replace('/*', '').replace(/^@/, '')
})
assert.deepStrictEqual(
  tsconfigPackages.sort(),
  packages.filter((pkg) => pkg.anonymous !== true).map((pkg) => pkg.name).sort(),
  'The package list in eslint.config.js is out of sync with tsconfig.base.json'
)

/**
 * @type {import('eslint').Linter.Config}
 */
const crossPackageRelativeImportRestrictions = {
  files: ['**/*.{js,mjs,cjs,jsx,ts,tsx}'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: packages
        .filter((pkg) => pkg.anonymous !== true)
        .map((pkg) => ({
          group: [`**/${pkg.name}/src`, `**/${pkg.name}/src/**`],
          message: `Use @${pkg.name} imports instead of relative paths into the ${pkg.name} package.`
        }))
    }]
  }
}

/**
 * @type {import('eslint').Linter.Config[]}
 */
const selfImportRestrictions = packages
  .filter((pkg) => pkg.anonymous !== true)
  .map((pkg) => ({
    files: [`packages/${pkg.name}/**`],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: [`@${pkg.name}`, `@${pkg.name}/*`],
            message: `Use relative imports instead of @${pkg.name} within the ${pkg.name} package.`
          },
          {
            group: [`**/${pkg.name}/src`, `**/${pkg.name}/src/**`],
            message: `Use direct relative imports instead of paths that route through ${pkg.name}/src.`
          },
          ...packages
            .filter((otherPkg) => otherPkg.anonymous !== true && otherPkg.name !== pkg.name)
            .map((otherPkg) => ({
              group: [`**/${otherPkg.name}/src`, `**/${otherPkg.name}/src/**`],
              message: `Use @${otherPkg.name} imports instead of relative paths into the ${otherPkg.name} package.`
            }))
        ]
      }]
    }
  }))

/**
 * Workaround for improperly typed eslint-plugin-react-hooks.
 *
 * @type {import('@eslint/core').Plugin}
 */
const reactHooksPlugin = /** @type {any} */ (fixupPluginRules(/** @type {any} */ (pluginReactHooks)))

export default defineConfig([
  ...eslintConfig,
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat['jsx-runtime'],
  {
    ignores: [
      'dist',
      'packages/*/dist'
    ]
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
      'react-hooks': reactHooksPlugin
    },

    settings: {
      react: {
        version: 'detect'
      },

      'import/resolver': {
        typescript: {
          project: './tsconfig.lint.json'
        }
      }
    },

    rules: {
      // @ts-expect-error eslint-plugin-react-hooks is improperly typed
      ...fixupConfigRules(pluginReactHooks.configs.recommended).rules,

      'no-console': ['error'],

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
      'react/jsx-wrap-multilines': 'off',

      // node:test
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          allowForKnownSafeCalls: [
            { from: 'package', name: ['describe', 'it', 'suite', 'test'], package: 'node:test' }
          ]
        }
      ],

      'import/extensions': [
        'error',
        'always',
        {
          ignorePackages: true,
          pattern: {
            js: 'always',
            grammar: 'always',

            jsx: 'never',
            ts: 'never',
            tsx: 'never'
          }
        }
      ],

      // monorepo: Prevent cross-package imports that violate dependency direction
      'import/no-restricted-paths': [
        'error',
        {
          basePath: import.meta.dirname,
          zones: packages.map((pkg) => {
            const blocklist = packages.filter((item) => {
              return item.name !== pkg.name && !pkg.dependencies.includes(item.name)
            })

            return {
              target: `./packages/${pkg.name}`,
              from: blocklist.map((blocked) => `./packages/${blocked.name}`)
            }
          })
        }
      ]
    }
  },

  // monorepo: Prevent relative imports into package source directories; use @alias imports instead.
  crossPackageRelativeImportRestrictions,

  // monorepo: Prevent packages from importing themselves via their @ alias (use relative imports instead)
  ...selfImportRestrictions
])
