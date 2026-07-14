import { fixupConfigRules, fixupPluginRules } from '@eslint/compat'
import eslintConfig from '@meyfa/eslint-config'
import pluginReact from 'eslint-plugin-react'
import pluginReactHooks from 'eslint-plugin-react-hooks'
import { defineConfig } from 'eslint/config'

const packages = [
  {
    name: 'app',
    dependencies: [
      'ast',
      'audiograph',
      'codecs',
      'core',
      'editor',
      'flowchart',
      'language',
      'language-support',
      'utility',
      'webaudio'
    ],
    anonymous: true // not exposed via "@meyfa/cadence-app"
  },
  {
    name: 'ast',
    dependencies: [
      'core',
      'utility'
    ]
  },
  {
    name: 'audiograph',
    dependencies: [
      'core',
      'utility'
    ]
  },
  {
    name: 'codecs',
    dependencies: [
      'utility'
    ]
  },
  {
    name: 'core',
    dependencies: [
      'utility'
    ]
  },
  {
    name: 'editor',
    dependencies: [
      'utility'
    ]
  },
  {
    name: 'flowchart',
    dependencies: [
      'utility'
    ]
  },
  {
    name: 'language',
    dependencies: [
      'ast',
      'core',
      'utility'
    ]
  },
  {
    name: 'language-support',
    dependencies: [
      'ast',
      'core',
      'language',
      'utility'
    ]
  },
  {
    name: 'utility',
    dependencies: []
  },
  {
    name: 'webaudio',
    dependencies: [
      'audiograph',
      'core',
      'utility'
    ]
  }
]

/**
 * @param {{ name: string }} pkg
 * @returns {string}
 */
function formatPackageName (pkg) {
  return `@meyfa/cadence-${pkg.name}`
}

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
          message: `Use ${formatPackageName(pkg)} imports instead of relative paths into the ${pkg.name} package.`
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
            group: [formatPackageName(pkg), `${formatPackageName(pkg)}/*`],
            message: `Use relative imports instead of ${formatPackageName(pkg)} within the ${pkg.name} package.`
          },
          {
            group: [`**/${pkg.name}/src`, `**/${pkg.name}/src/**`],
            message: `Use direct relative imports instead of paths that route through ${pkg.name}/src.`
          },
          ...packages
            .filter((otherPkg) => otherPkg.anonymous !== true && otherPkg.name !== pkg.name)
            .map((otherPkg) => ({
              group: [`**/${otherPkg.name}/src`, `**/${otherPkg.name}/src/**`],
              message: `Use ${formatPackageName(otherPkg)} imports instead of relative paths into the ${otherPkg.name} package.`
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
      'packages/*/dist',

      // TypeScript treats worklets as global scripts which interfere with one another.
      // They must be excluded from the TSConfig, and therefore also from ESLint, which relies on the TSConfig.
      'packages/webaudio/src/**/*.worklet.js'
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
            ts: 'always',
            tsx: 'always',
            grammar: 'always',
            js: 'never',
            jsx: 'never'
          }
        }
      ],

      'import/no-unresolved': 'error',

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
