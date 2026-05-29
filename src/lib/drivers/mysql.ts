import { createPool } from 'mysql2/promise';
import type { Pool } from 'mysql2/promise';
import { type DatabaseDriver, type ConnectionConfig, type QueryResult } from './types';

export class MySqlDriver implements DatabaseDriver {
  private pool: Pool;

  constructor(config: ConnectionConfig) {
    this.pool = createPool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      connectionLimit: 3,
      idleTimeout: 60_000,
      connectTimeout: 10_000,
    });
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const [rows] = await this.pool.execute(sql, params as any[]);
    return { rows: rows as Record<string, unknown>[], fields: [], rowCount: Array.isArray(rows) ? rows.length : 0 };
  }
}
