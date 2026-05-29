import { PostgresDriver } from './postgres';
import { MySqlDriver } from './mysql';
import { type ConnectionConfig, type DatabaseDriver } from './types';

export type { DatabaseDriver };

const driverPool = new Map<string, DatabaseDriver>();

function createDriver(connectionId: string, type: string, config: ConnectionConfig): DatabaseDriver {
  if (typeof config.password !== 'string') {
    throw new Error(`Invalid password for connection "${connectionId}": expected string, got ${typeof config.password}`);
  }

  const existing = driverPool.get(connectionId);
  if (existing) return existing;

  let driver: DatabaseDriver;
  switch (type) {
    case 'postgres':
      driver = new PostgresDriver(config);
      break;
    case 'mysql':
      driver = new MySqlDriver(config);
      break;
    default:
      throw new Error(`Unsupported database type: "${type}". Available: postgres, mysql`);
  }

  driverPool.set(connectionId, driver);
  return driver;
}

export function evictDriverIfAuthError(connectionId: string, err: unknown): void {
  if (!driverPool.has(connectionId)) return;
  const msg = err instanceof Error ? err.message : String(err);
  if (/password|SASL|SCRAM|authentication|auth/i.test(msg)) {
    driverPool.delete(connectionId);
  }
}

export function createDriverFromConnection(
  connectionId: string,
  conn: { type: string; host: string; port: number; database: string; username: string; ssl: boolean },
  password: string
) {
  return createDriver(connectionId, conn.type, {
    host: conn.host,
    port: conn.port,
    database: conn.database,
    username: conn.username,
    password,
    ssl: conn.ssl,
  });
}
