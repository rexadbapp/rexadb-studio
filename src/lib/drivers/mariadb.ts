import { createPool } from 'mariadb';
import { type ConnectionConfig, type DatabaseDriver, type QueryResult } from './types';
import { poolOptions } from './shared/pool-config';

export class MariaDbDriver implements DatabaseDriver {
  private pool: ReturnType<typeof createPool>;

  constructor(config: ConnectionConfig) {
    this.pool = createPool(poolOptions(config));
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const rows = await this.pool.query(sql, params ?? []);
    const rawRows = rows as Record<string, unknown>[];
    return {
      rows: rawRows,
      fields: rawRows.length > 0 ? Object.keys(rawRows[0]) : [],
      rowCount: rawRows.length,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
