const expo = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

module.exports = [
  ...expo,
  prettier,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*'],
  },
  {
    rules: {
      // Arabic copy is full of quotes and guillemets; formatting is Prettier's job.
      'react/no-unescaped-entities': 'off',
    },
  },
];
