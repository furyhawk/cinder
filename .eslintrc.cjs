module.exports = {
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    'no-restricted-globals': ['error', 'Math.random', 'Date.now', 'performance.now'],
    'no-restricted-imports': ['error', {
      patterns: ['../render/**', '../audio/**', '../ui/**', 'pixi.js']
    }],
  },
  overrides: [
    {
      files: ['src/sim/**/*.ts'],
      rules: {
        'import/no-restricted-paths': 'off'
      }
    }
  ]
};
