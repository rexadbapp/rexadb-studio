import { createPool } from 'mysql2/promise';
import type { Pool } from 'mysql2/promise';
import type { DatabaseDriver, ConnectionConfig, QueryResult } from './index';

export class MySqlDriver implements DatabaseDriver {
  private pool: Pool;
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
    this.pool = createPool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : undefined,
      connectionLimit: 3,
      idleTimeout: 60_000,
      connectTimeout: 10_000,
    });
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const [rows] = await this.pool.execute(sql, params as any[]);
    const fieldNames: string[] = [];
    return {
      rows: rows as Record<string, unknown>[],
      fields: fieldNames,
      rowCount: Array.isArray(rows) ? rows.length : 0,
    };
  }

  isReadOnlyQuery(sql: string): boolean {
    const trimmed = sql.trim().toUpperCase();
    if (/^(SELECT|WITH|EXPLAIN|DESCRIBE|SHOW)\b/.test(trimmed)) return true;
    if (/^(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|GRANT|REVOKE)\b/.test(trimmed)) return false;
    return false;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.pool.execute('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
