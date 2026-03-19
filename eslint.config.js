import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

const sharedRules = {
  'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
}

export default defineConfig([
  globalIgnores(['dist', 'functions/node_modules']),
  {
    files: ['src/**/*.{js,jsx}'],
    ignores: ['src/**/*.test.js'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: sharedRules,
  },
  {
    files: ['src/**/*.test.js', 'tests/**/*.js', 'vite.config.js', 'eslint.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: sharedRules,
  },
  {
    files: ['functions/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: sharedRules,
  },
  {
    files: ['src/context/AuthContext.jsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
