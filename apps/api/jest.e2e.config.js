/**
 * Testes de integração (precisam de um PostgreSQL acessível).
 * Usam um banco separado (`leilao_test`), criado automaticamente. Veja o README, seção "Testes".
 */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  globalSetup: '<rootDir>/test/global-setup.js',
  testTimeout: 60000,
};
