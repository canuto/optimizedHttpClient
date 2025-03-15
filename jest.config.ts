export default {
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            // ts-jest configuration goes here
            tsconfig: 'tsconfig.json', // Specify your tsconfig file if needed
        }],
    },
    testEnvironment: 'node', // or 'jsdom', depending on your needs
    transformIgnorePatterns: [
        '/node_modules/(?!node-fetch)',
    ],
    extensionsToTreatAsEsm: ['.ts'],
    testMatch: [
        '**/__tests__/**/*.test.(js|ts)', // Include only specific test files
        '!**/__tests__/integration/**',   // Exclude integration tests
    ],
};