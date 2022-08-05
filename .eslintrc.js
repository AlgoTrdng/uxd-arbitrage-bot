module.exports = {
  env: {
    es2021: true,
    node: true,
    browser: true,
  },
  extends: [
    'airbnb-base',
    'plugin:import/typescript',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
  ],
  rules: {
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never', jsx: 'never', ts: 'never', tsx: 'never',
      },
    ],
    'no-use-before-define': 0,
    'no-underscore-dangle': 0,
    semi: ['error', 'never'],
    camelcase: 0,
    'no-param-reassign': 0,
    'import/prefer-default-export': 0,
    'lines-between-class-members': 0,
    'no-await-in-loop': 0,
    'no-useless-constructor': 0,
    'no-unused-vars': 'warn',
    'no-empty-function': 0,
    'no-continue': 0,
  },
}
