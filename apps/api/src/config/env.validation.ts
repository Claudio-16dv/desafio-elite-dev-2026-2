import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Variáveis de ambiente da API. A aplicação falha na inicialização (fail-fast)
 * se alguma estiver ausente ou inválida, em vez de quebrar tarde em runtime.
 */
export class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 4000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  /** Segredo de assinatura dos tokens JWT. */
  @IsString()
  @MinLength(16)
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN: string = '7d';

  /**
   * Segredo do HMAC da cadeia de hashes (auditoria) e dos pseudônimos.
   * Fica FORA do banco: quem só tem acesso ao banco não consegue recalcular hashes.
   */
  @IsString()
  @MinLength(16)
  AUDIT_SECRET!: string;

  /** Origens permitidas no CORS, separadas por vírgula. */
  @IsString()
  @IsNotEmpty()
  CORS_ORIGINS: string = 'http://localhost:3000';

  @IsIn(['true', 'false'])
  SEED_ON_BOOT: 'true' | 'false' = 'false';

  @IsUrl({ require_tld: false })
  CATALOG_API_URL: string = 'https://openaccess-api.clevelandart.org/api';

  @IsInt()
  @Min(500)
  @Max(30000)
  CATALOG_TIMEOUT_MS: number = 5000;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const instance = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(instance, { skipMissingProperties: false });
  const details = errors.map(
    (e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
  );
  details.push(...insecureSecretErrors(instance));
  if (details.length > 0) {
    throw new Error(`Configuração de ambiente inválida:\n${details.join('\n')}`);
  }
  return instance;
}

/** Prefixos dos valores públicos do docker-compose.yml e do .env.example. */
const PLACEHOLDER_SECRET_PREFIXES = ['dev-only-', 'troque-'];
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Os segredos padrão são públicos (estão no repositório). Com eles, qualquer pessoa
 * forjaria logins (JWT) e recalcularia a cadeia de hashes da auditoria (AUDIT_SECRET).
 * Por isso, se a API aceita alguma origem que NÃO é local (ou seja, está publicada),
 * ela se recusa a iniciar com esses valores. O uso local continua funcionando sem .env.
 */
function insecureSecretErrors(env: EnvironmentVariables): string[] {
  const origins = (env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  const isPublic = origins.some((origin) => {
    try {
      return !LOCAL_HOSTS.has(new URL(origin).hostname);
    } catch {
      return true;
    }
  });
  if (!isPublic) return [];

  return (['JWT_SECRET', 'AUDIT_SECRET'] as const)
    .filter((name) => {
      const value = env[name] ?? '';
      return PLACEHOLDER_SECRET_PREFIXES.some((prefix) => value.startsWith(prefix));
    })
    .map(
      (name) =>
        `  - ${name}: está com o valor público de exemplo, mas CORS_ORIGINS aponta para um endereço público. Gere um segredo (openssl rand -base64 48).`,
    );
}
