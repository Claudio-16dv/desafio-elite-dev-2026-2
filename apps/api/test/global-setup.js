/**
 * Prepara o banco de testes: cria `leilao_test` (se não existir) e aplica as migrations.
 * Os testes de integração NUNCA tocam no banco de desenvolvimento/demonstração.
 *
 * Variáveis:
 *   TEST_DATABASE_URL  URL do banco de testes (padrão: mesmo servidor, banco "leilao_test")
 */
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const DEFAULT_TEST_URL = 'postgresql://leilao:leilao@127.0.0.1:5432/leilao_test?schema=public';

module.exports = async () => {
  const testUrl = process.env.TEST_DATABASE_URL || DEFAULT_TEST_URL;
  const parsed = new URL(testUrl);
  const dbName = parsed.pathname.replace(/^\//, '');
  if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
    throw new Error(`Nome de banco de teste inválido: ${dbName}`);
  }
  if (!dbName.includes('test')) {
    throw new Error(`Por segurança, o banco de testes precisa ter "test" no nome (recebido: ${dbName}).`);
  }

  // Conecta no banco de manutenção "postgres" só para criar o banco de testes.
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  } catch (error) {
    if (!String(error.message).includes('already exists')) throw error;
  } finally {
    await admin.$disconnect();
  }

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testUrl },
  });
  process.env.TEST_DATABASE_URL = testUrl;
};
