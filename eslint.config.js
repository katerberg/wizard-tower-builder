import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'eslint.config.js', 'scripts/'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.test.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
  {
    files: ['vite.config.ts'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['src/model/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/store', '@/store/*', '@/view', '@/view/*', '**/store/*', '**/view/*'],
              message: 'model/ must not import store/ or view/',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/calculations/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/store', '@/store/*', '@/view', '@/view/*'],
              message: 'calculations/ must not import store/ or view/',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/store/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/view', '@/view/*', '**/view/*'],
              message: 'store/ must not import view/ — keep the engine UI-agnostic',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/view/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/model/tower',
              importNames: [
                'canPlace',
                'placeRoom',
                'placeRoomReplacing',
                'validateTower',
                'isTowerStable',
              ],
              message: 'view/ must use selectors for placement affordances, not rule predicates',
            },
            {
              name: '@/model/modifications',
              importNames: ['canApplyModification', 'canUpgradeModification', 'modificationCost'],
              message: 'view/ must use selectors for modification affordances',
            },
          ],
        },
      ],
    },
  },
);
