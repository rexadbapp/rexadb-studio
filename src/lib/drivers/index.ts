import { PostgresDriver } from './postgres';
import { MySqlDriver } from './mysql';

export interface QueryResult {
  rows: Record<string, unknown>[];
  fields: string[];
  rowCount: number;
}

export interface ConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

export interface DatabaseDriver {
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  testConnection(): Promise<boolean>;
  isReadOnlyQuery?(sql: string): boolean | Promise<boolean>;
}

const driverPool = new Map<string, DatabaseDriver>();

export function createDriver(connectionId: string, type: string, config: ConnectionConfig): DatabaseDriver {
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

export function releaseDriver(connectionId: string): void {
  driverPool.delete(connectionId);
}

export function releaseAllDrivers(): void {
  driverPool.clear();
}
