import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import nextPlugin from '@next/eslint-plugin-next'
import reactHooks from 'eslint-plugin-react-hooks'
import hospitalArchitecturePlugin from './eslint-rules/hospital-architecture.mjs'

const TEST_FILES = [
  'src/**/*.test.ts',
  'src/**/*.test.tsx',
  'src/**/__tests__/**/*.ts',
  'src/**/__tests__/**/*.tsx',
]

const eslintConfig = defineConfig([
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'node_modules/**',
    'scripts/**',
    'storage/**',
    'public/**',
    '.agents/**',
    'opendesigner/**',
    'docs/**',
  ]),

  // Base TypeScript + Next.js Core Web Vitals + React Hooks
  ...tseslint.configs.recommended,
  nextPlugin.configs['core-web-vitals'],
  {
    plugins: {
      'react-hooks': reactHooks,
      hospital: hospitalArchitecturePlugin,
    },
    rules: {
      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Debt burn-down warnings for UI components & legacy modules
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-empty': ['warn', { allowEmptyCatch: false }],
      'max-lines': ['warn', { max: 1000, skipBlankLines: true, skipComments: true }],
    },
  },

  // Global Hospital Architecture & Security Guardrails across all non-test src/ files
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: TEST_FILES,
    rules: {
      'hospital/no-raw-sql': 'error',
      'hospital/no-legacy-db-wrappers': 'error',
      'hospital/no-static-exceljs-in-client': 'error',
      'hospital/no-unsafe-innerhtml': 'error',
      'hospital/max-file-lines': ['error', { max: 2000 }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'mysql2',
              message:
                'Direct mysql2 sockets are forbidden (Zero-SQL Gateway rule). Use @/lib/apiGateway.',
            },
            {
              name: 'mysql2/promise',
              message:
                'Direct mysql2 sockets are forbidden (Zero-SQL Gateway rule). Use @/lib/apiGateway.',
            },
          ],
        },
      ],
    },
  },

  // Zero-Tolerance Logging & Error Handling in API Routes and Domain Services
  {
    files: ['src/app/api/**/*.ts', 'src/lib/**/*.ts', 'src/lib/**/*.tsx'],
    ignores: TEST_FILES,
    rules: {
      'no-console': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
    },
  },

  // Strict Type Safety, Thin Adapters, and File Seam Enforcement in API Routes
  {
    files: ['src/app/api/**/*.ts'],
    ignores: TEST_FILES,
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/memberAuth',
              importNames: ['getAuthenticatedMember'],
              message:
                'Use requireMemberApi() or verifyMemberSession() in API route handlers — getAuthenticatedMember() calls redirect() for Server Components.',
            },
            {
              name: 'fs',
              message:
                'Use DocumentStorage from @/lib/storage/documentStorage instead of raw fs in API routes.',
            },
            {
              name: 'node:fs',
              message:
                'Use DocumentStorage from @/lib/storage/documentStorage instead of raw fs in API routes.',
            },
            {
              name: 'fs/promises',
              message:
                'Use DocumentStorage from @/lib/storage/documentStorage instead of raw fs/promises in API routes.',
            },
            {
              name: 'node:fs/promises',
              message:
                'Use DocumentStorage from @/lib/storage/documentStorage instead of raw fs/promises in API routes.',
            },
            {
              name: 'mysql2',
              message:
                'Direct mysql2 sockets are forbidden (Zero-SQL Gateway rule). Use @/lib/apiGateway.',
            },
            {
              name: 'mysql2/promise',
              message:
                'Direct mysql2 sockets are forbidden (Zero-SQL Gateway rule). Use @/lib/apiGateway.',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['src/app/api/**/route.ts'],
    rules: {
      'max-lines': ['error', { max: 200, skipBlankLines: false, skipComments: false }],
    },
  },

  // Relax noisy / sample-fixture rules inside Vitest test files
  {
    files: TEST_FILES,
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-console': 'off',
      '@next/next/no-img-element': 'off',
      'max-lines': 'off',
      'hospital/no-raw-sql': 'off',
      'hospital/no-legacy-db-wrappers': 'off',
      'hospital/no-static-exceljs-in-client': 'off',
      'hospital/no-unsafe-innerhtml': 'off',
      'hospital/max-file-lines': 'off',
    },
  },
])

export default eslintConfig
