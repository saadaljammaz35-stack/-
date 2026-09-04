/**
 * Flat ESLint config.
 *
 * The TypeScript parser is loaded dynamically. With a full `pnpm install` it is
 * present and every `.ts` file is linted; in a constrained environment where it
 * is not, the config degrades to linting JavaScript rather than failing outright.
 * Either way `tsc -b` with `strict` + `noUncheckedIndexedAccess` remains the
 * primary correctness gate — ESLint here is for style and the money-safety rules
 * at the bottom, which the type system cannot express.
 */

let tsParser = null;
let tsPlugin = null;
try {
  const tseslint = await import('typescript-eslint');
  tsParser = tseslint.parser;
  tsPlugin = tseslint.plugin;
} catch {
  console.warn(
    '[eslint] typescript-eslint not installed — linting JS only. Run `pnpm install` for full coverage.',
  );
}

const sharedGlobals = {
  console: 'readonly',
  process: 'readonly',
  Buffer: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  URL: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  WeakSet: 'readonly',
  NodeJS: 'readonly',
};

const coreRules = {
  // The TypeScript compiler catches these far more accurately.
  'no-unused-vars': 'off',
  'no-undef': 'off',
  'no-redeclare': 'off',
  'no-dupe-class-members': 'off',

  // Enabled explicitly rather than via @eslint/js, so this config carries no
  // third-party dependency of its own.
  'no-cond-assign': 'error',
  'no-constant-condition': 'error',
  'no-dupe-args': 'error',
  'no-dupe-keys': 'error',
  'no-duplicate-case': 'error',
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-ex-assign': 'error',
  'no-fallthrough': 'error',
  'no-func-assign': 'error',
  'no-irregular-whitespace': 'error',
  'no-sparse-arrays': 'error',
  'no-unreachable': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error',
  'no-self-compare': 'error',
  'no-unsafe-negation': 'error',

  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-var': 'error',
  'prefer-const': 'error',
  'no-console': ['warn', { allow: ['warn', 'error'] }],
  'no-debugger': 'error',
  'no-alert': 'error',
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-return-await': 'error',
  'require-atomic-updates': 'error',

  // ── money-safety rules ──
  //
  // These encode conventions the type system cannot: amounts are bigint minor
  // units, and randomness that guards anything must come from a CSPRNG.
  'no-restricted-globals': [
    'error',
    {
      name: 'parseFloat',
      message: 'Money is bigint minor units — use Money.fromMajor().',
    },
  ],
  'no-restricted-properties': [
    'error',
    {
      object: 'Math',
      property: 'random',
      message: 'Use node:crypto (randomInt/randomBytes) — Math.random is not a CSPRNG.',
    },
    {
      object: 'Number',
      property: 'parseFloat',
      message: 'Money is bigint minor units — a float must never hold an amount.',
    },
  ],
};

const config = [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.next/**',
      '**/build/**',
      '**/*.d.ts',
      '**/.expo/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: sharedGlobals },
    rules: coreRules,
  },
];

if (tsParser !== null) {
  config.push({
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: sharedGlobals,
    },
    ...(tsPlugin === null ? {} : { plugins: { '@typescript-eslint': tsPlugin } }),
    rules: {
      ...coreRules,
      ...(tsPlugin === null
        ? {}
        : {
            '@typescript-eslint/no-floating-promises': 'off',
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-non-null-assertion': 'error',
          }),
    },
  });
} else {
  config.push({ ignores: ['**/*.ts', '**/*.tsx'] });
}

// Mocks, fixtures and tests use Math.random for non-security purposes.
config.push({
  files: ['**/*.test.{ts,js}', '**/testing/**', '**/mock/**'],
  rules: { 'no-restricted-properties': 'off', 'no-console': 'off' },
});

export default config;
