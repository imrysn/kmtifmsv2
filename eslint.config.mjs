import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'dist-server/**',
            'build/**',
            'logs/**',
            '*.log',
            '.env*',
            'client/dist/**',
            'client/node_modules/**',
            'coverage/**',
            '*.min.js'
        ]
    },
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                console: 'readonly',
                process: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly',
                Buffer: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                Promise: 'readonly'
            }
        },
        rules: {
            'no-console': 'off',
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-undef': 'error',
            'semi': ['error', 'always'],
            'quotes': ['warn', 'single', { avoidEscape: true }],
            'no-var': 'error',
            'prefer-const': 'warn',
            'eqeqeq': ['error', 'always'],
            'curly': ['error', 'all'],
            'brace-style': ['error', '1tbs'],
            'no-trailing-spaces': 'warn',
            'comma-dangle': ['warn', 'never'],
            'arrow-spacing': 'warn',
            'keyword-spacing': 'warn',
            'space-before-blocks': 'warn',
            'object-curly-spacing': ['warn', 'always'],
            'array-bracket-spacing': ['warn', 'never'],
            'no-multiple-empty-lines': ['warn', { max: 2 }],
            'indent': ['warn', 2, { SwitchCase: 1 }]
        }
    }
];
