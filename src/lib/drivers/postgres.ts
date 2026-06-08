import { Pool } from 'pg';
import { type DatabaseDriver, type ConnectionConfig, type QueryResult } from './types';

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
    this.pool.on('error', (err) => console.error('[postgres] pool error:', err.message));
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const result = await this.pool.query(sql, params ?? []);
    return {
      rows: result.rows as Record<string, unknown>[],
      fields: result.fields.map((f) => f.name),
      rowCount: result.rowCount ?? 0,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
