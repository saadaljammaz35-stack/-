/**
 * Configuration and environment separation.
 *
 * The `assertProductionSafety` check at the bottom is the important part: it
 * turns "don't run production with development secrets" from a wiki page into a
 * startup assertion. A misconfigured production deploy fails to boot loudly
 * instead of quietly accepting real customer money into a simulator.
 */

import { ConfigurationError } from '@nabd/shared';

export type Environment = 'development' | 'staging' | 'production';

export interface AppConfig {
  readonly env: Environment;
  readonly port: number;
  readonly apiPrefix: string;

  readonly database: {
    readonly url: string;
    readonly poolMax: number;
    readonly statementTimeoutMs: number;
  };

  readonly redis: { readonly url: string };

  readonly auth: {
    readonly jwtSecret: string;
    readonly jwtIssuer: string;
    readonly jwtAudience: string;
    readonly accessTokenTtlSeconds: number;
    readonly refreshTokenTtlDays: number;
  };

  readonly security: {
    readonly encryptionKey: string;
    readonly corsOrigins: readonly string[];
    readonly trustProxyHops: number;
  };

  readonly providers: {
    readonly payment: string;
    readonly banking: string;
    readonly card: string;
    readonly kyc: string;
    readonly sanctions: string;
  };

  readonly features: {
    readonly seedData: boolean;
    readonly swaggerEnabled: boolean;
  };
}

/** Values that must never appear in a production deployment. */
const DEVELOPMENT_SENTINELS = [
  'changeme',
  'change-me',
  'development-only',
  'dev-secret',
  'localhost',
  'password',
  'secret',
  'test',
  'example',
  'insecure',
  'do-not-use-in-production',
];

function required(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === '') {
    throw new ConfigurationError(`Missing required environment variable: ${name}`, {
      name,
    });
  }
  return value;
}

function optionalInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new ConfigurationError(`Expected an integer, received "${value}"`);
  }
  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = (env['NODE_ENV'] ?? 'development') as Environment;
  if (!['development', 'staging', 'production'].includes(nodeEnv)) {
    throw new ConfigurationError(`Unknown NODE_ENV: ${nodeEnv}`);
  }

  const config: AppConfig = {
    env: nodeEnv,
    port: optionalInt(env['PORT'], 3000),
    apiPrefix: env['API_PREFIX'] ?? 'v1',

    database: {
      url: required('DATABASE_URL', env['DATABASE_URL']),
      poolMax: optionalInt(env['DATABASE_POOL_MAX'], 10),
      statementTimeoutMs: optionalInt(env['DATABASE_STATEMENT_TIMEOUT_MS'], 10_000),
    },

    redis: { url: required('REDIS_URL', env['REDIS_URL']) },

    auth: {
      jwtSecret: required('JWT_SECRET', env['JWT_SECRET']),
      jwtIssuer: env['JWT_ISSUER'] ?? 'nabd',
      jwtAudience: env['JWT_AUDIENCE'] ?? 'nabd-app',
      accessTokenTtlSeconds: optionalInt(env['ACCESS_TOKEN_TTL_SECONDS'], 900),
      refreshTokenTtlDays: optionalInt(env['REFRESH_TOKEN_TTL_DAYS'], 30),
    },

    security: {
      encryptionKey: required('ENCRYPTION_KEY', env['ENCRYPTION_KEY']),
      corsOrigins: (env['CORS_ORIGINS'] ?? '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
      trustProxyHops: optionalInt(env['TRUST_PROXY_HOPS'], 1),
    },

    providers: {
      payment: env['PAYMENT_PROVIDER'] ?? 'mock',
      banking: env['BANKING_PROVIDER'] ?? 'mock',
      card: env['CARD_PROVIDER'] ?? 'mock',
      kyc: env['KYC_PROVIDER'] ?? 'mock',
      sanctions: env['SANCTIONS_PROVIDER'] ?? 'mock',
    },

    features: {
      seedData: env['ENABLE_SEED_DATA'] === 'true',
      swaggerEnabled: env['ENABLE_SWAGGER'] !== 'false',
    },
  };

  assertProductionSafety(config);
  return config;
}

/**
 * Refuses to start a production process that is not actually production-ready.
 *
 * Every check here corresponds to a real way fintech deployments have gone
 * wrong: shipping with a demo signing key, pointing production at a sandbox
 * provider, or leaving seed data enabled so a "Demo User" exists with a
 * spendable balance.
 */
export function assertProductionSafety(config: AppConfig): void {
  if (config.env !== 'production') return;
  const problems: string[] = [];

  const secrets: Array<[string, string]> = [
    ['JWT_SECRET', config.auth.jwtSecret],
    ['ENCRYPTION_KEY', config.security.encryptionKey],
  ];

  for (const [name, value] of secrets) {
    const lower = value.toLowerCase();
    for (const sentinel of DEVELOPMENT_SENTINELS) {
      if (lower.includes(sentinel)) {
        problems.push(`${name} contains the development marker "${sentinel}"`);
        break;
      }
    }
    if (value.length < 32) problems.push(`${name} is shorter than 32 characters`);
    if (/^(.)\1+$/.test(value)) problems.push(`${name} is a single repeated character`);
  }

  // A mock provider in production means customer money would be "moved" by a
  // simulator that settles nothing.
  for (const [name, value] of Object.entries(config.providers)) {
    if (value === 'mock' || value.startsWith('mock-')) {
      problems.push(`Provider "${name}" is set to a mock implementation`);
    }
  }

  if (config.features.seedData) {
    problems.push('ENABLE_SEED_DATA is true — seed data must never exist in production');
  }
  if (
    config.database.url.includes('localhost') ||
    config.database.url.includes('127.0.0.1')
  ) {
    problems.push('DATABASE_URL points at localhost');
  }
  if (config.security.corsOrigins.length === 0) {
    problems.push('CORS_ORIGINS is empty — production must list explicit origins');
  }
  if (config.security.corsOrigins.includes('*')) {
    problems.push('CORS_ORIGINS contains a wildcard');
  }

  if (problems.length > 0) {
    throw new ConfigurationError(
      `Refusing to start in production with an unsafe configuration:\n  - ${problems.join('\n  - ')}`,
      { problems },
    );
  }
}
