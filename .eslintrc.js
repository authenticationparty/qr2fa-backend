// eslint-disable-next-line no-undef
module.exports = {
    env: {
        node: true,
        es2021: true,
    },
    extends: [
        'eslint:recommended', 'google',
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
        'indent': ['error', 4],
        'max-len': ['warn', 120],
        'new-cap': ['off'],
    },
};
