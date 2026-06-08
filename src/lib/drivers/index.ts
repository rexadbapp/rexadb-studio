import { PostgresDriver } from './postgres';
import { MySqlDriver } from './mysql';
import { MariaDbDriver } from './mariadb';
import { MssqlDriver } from './mssql';
import { CockroachDbDriver } from './cockroachdb';
import { YugabyteDriver } from './yugabyte';
import { RedshiftDriver } from './redshift';
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
    case 'mariadb':
      driver = new MariaDbDriver(config);
      break;
    case 'mssql':
      driver = new MssqlDriver(config);
      break;
    case 'cockroachdb':
      driver = new CockroachDbDriver(config);
      break;
    case 'yugabyte':
      driver = new YugabyteDriver(config);
      break;
    case 'redshift':
      driver = new RedshiftDriver(config);
      break;
    default:
      throw new Error(`Unsupported database type: "${type}". Available: postgres, mysql, mariadb, mssql, cockroachdb, yugabyte, redshift`);
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
