import { createPool } from 'mysql2/promise';
import type { Pool } from 'mysql2/promise';
import { type DatabaseDriver, type ConnectionConfig, type QueryResult } from './types';
import { poolOptions } from './shared/pool-config';

export class MySqlDriver implements DatabaseDriver {
  private pool: Pool;

  constructor(config: ConnectionConfig) {
    this.pool = createPool(poolOptions(config));
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const [rows] = await this.pool.execute(sql, params as any[]);
    return { rows: rows as Record<string, unknown>[], fields: [], rowCount: Array.isArray(rows) ? rows.length : 0 };
  }
}
