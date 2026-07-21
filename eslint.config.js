import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

const strictTypeRuleKeys = [
  '@typescript-eslint/no-unsafe-assignment',
  '@typescript-eslint/no-unsafe-member-access',
  '@typescript-eslint/no-unsafe-call',
  '@typescript-eslint/no-unsafe-return',
  '@typescript-eslint/no-unsafe-argument',
  '@typescript-eslint/no-floating-promises',
  '@typescript-eslint/no-misused-promises',
  '@typescript-eslint/no-unnecessary-type-assertion',
  '@typescript-eslint/require-await',
  '@typescript-eslint/restrict-template-expressions',
]

const gradualTypeRules = Object.fromEntries(
  strictTypeRuleKeys.map((key) => [key, 'off']),
)

const strictTypeRules = Object.fromEntries(
  strictTypeRuleKeys.map((key) => [key, 'error']),
)

const isStrictLint = process.env.ESLINT_STRICT === '1'

const phasedTypeSafetyFiles = [
  'src/lib/**/*.{ts,tsx}',
  'src/hooks/**/*.{ts,tsx}',
  'src/store/**/*.{ts,tsx}',
  'src/components/**/*.{ts,tsx}',
]

const phasedTypeSafetyRules = {
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-unsafe-assignment': 'error',
}

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'supabase/**'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...(isStrictLint ? strictTypeRules : gradualTypeRules),
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: phasedTypeSafetyFiles,
    rules: phasedTypeSafetyRules,
  },
  {
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
)
