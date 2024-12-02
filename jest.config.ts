import type { Config } from '@jest/types'

const packages: [name: string, folder?: string][] = [
    ['@comyata/run', 'comyata-run'],
    ['@comyata/fe', 'comyata-fe'],
]

const toPackageFolder = (pkg: [name: string, folder?: string]) => {
    return pkg[1] || pkg[0]
}

const base: Config.InitialProjectOptions = {
    preset: 'ts-jest/presets/default-esm',
    transformIgnorePatterns: [
        `node_modules/?!(${[...packages].map(toPackageFolder).join('|')})`,
    ],
    transform: {
        '^.+\\.ts$': ['ts-jest', {useESM: true}],
        '^.+\\.tsx$': ['ts-jest', {useESM: true}],
    },
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        // '^(\\.{1,2}/.*)\\.ts$': '$1',
        // '^(\\.{1,2}/.*)\\.tsx$': '$1',
        ...packages.reduce((nameMapper, pkg) => {
            nameMapper[`^${pkg[0]}\\/(.*)$`] = `<rootDir>/packages/${toPackageFolder(pkg)}/$1`
            nameMapper[`^${pkg[0]}$`] = `<rootDir>/packages/${toPackageFolder(pkg)}`
            return nameMapper
        }, {}),
    },
    moduleFileExtensions: [
        'ts',
        'tsx',
        'js',
        'jsx',
        'json',
        'node',
    ],
    extensionsToTreatAsEsm: ['.ts', '.tsx'],
    coveragePathIgnorePatterns: [
        '(tests/.*.mock).(jsx?|tsx?|ts?|js?)$',
        '<rootDir>/apps',
        '<rootDir>/server/fe',
    ],
    testPathIgnorePatterns: [
        '<rootDir>/dist',
    ],
    watchPathIgnorePatterns: [
        '<rootDir>/.idea',
        '<rootDir>/.git',
        '<rootDir>/node_modules',
        '<rootDir>/.+/.+/node_modules',
        '<rootDir>/dist',
        '<rootDir>/apps/sandbox/dist',
        '<rootDir>/server/fe/dist',
    ],
    modulePathIgnorePatterns: [
        '<rootDir>/dist',
        '<rootDir>/apps/sandbox/dist',
        '<rootDir>/server/fe/dist',
    ],
}

const config: Config.InitialOptions = {
    ...base,
    verbose: true,
    projects: [
        {
            displayName: 'test-apps-sandbox',
            ...base,
            moduleDirectories: ['node_modules', '<rootDir>/apps/sandbox/node_modules'],
            testMatch: [
                '<rootDir>/apps/sandbox/src/**/*.(test|spec).(js|ts|tsx)',
                '<rootDir>/apps/sandbox/tests/**/*.(test|spec).(js|ts|tsx)',
            ],
        },
        ...packages.map(pkg => ({
            displayName: 'test-' + pkg[0],
            ...base,
            moduleDirectories: [
                'node_modules', '<rootDir>/packages/' + toPackageFolder(pkg) + '/node_modules',
            ],
            testMatch: [
                '<rootDir>/packages/' + toPackageFolder(pkg) + '/src/**/*.(test|spec).(js|ts|tsx)',
                '<rootDir>/packages/' + toPackageFolder(pkg) + '/tests/**/*.(test|spec).(js|ts|tsx)',
            ],
        })),
    ],
    collectCoverage: true,
    coverageReporters: ['clover', 'json', 'lcov', 'text', 'html-spa'],
    coverageDirectory: '<rootDir>/coverage',
}

export default config
