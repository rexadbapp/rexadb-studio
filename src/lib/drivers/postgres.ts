import { Pool } from 'pg';
import type { DatabaseDriver, ConnectionConfig, QueryResult } from './index';

export class PostgresDriver implements DatabaseDriver {
  private pool: Pool;

  constructor(config: ConnectionConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: String(config.password),
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: 3,
      idleTimeoutMillis: 60_000,
      connectionTimeoutMillis: 10_000,
    });
    this.pool.on('error', () => {});
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const result = await this.pool.query(sql, params ?? []);
    return {
      rows: result.rows as Record<string, unknown>[],
      fields: result.fields.map((f) => f.name),
      rowCount: result.rowCount ?? 0,
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
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
