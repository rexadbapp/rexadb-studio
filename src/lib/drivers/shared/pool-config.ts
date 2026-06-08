import { type ConnectionConfig } from '../types';

export interface PoolOptions {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: { rejectUnauthorized: false } | undefined;
  connectionLimit: number;
  idleTimeout: number;
  connectTimeout: number;
}

export function poolOptions(config: ConnectionConfig): PoolOptions {
  return {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    connectionLimit: 3,
    idleTimeout: 60_000,
    connectTimeout: 10_000,
  };
}
