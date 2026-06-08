import sql from 'mssql';
import { type ConnectionConfig, type DatabaseDriver, type QueryResult } from './types';

export class MssqlDriver implements DatabaseDriver {
  private pool: sql.ConnectionPool;

  constructor(config: ConnectionConfig) {
    this.pool = new sql.ConnectionPool({
      server: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      options: {
        encrypt: config.ssl,
        trustServerCertificate: !config.ssl,
      },
      pool: {
        max: 3,
        idleTimeoutMillis: 60_000,
      },
      connectionTimeout: 10_000,
    });
    this.pool.on('error', () => {});
  }

  async query(sqlText: string, params?: unknown[]): Promise<QueryResult> {
    await this.pool.connect();
    const request = this.pool.request();
    if (params) {
      params.forEach((p, i) => {
        request.input(`p${i}`, p);
      });
    }
    const result = await request.query(sqlText);
    return {
      rows: result.recordset as Record<string, unknown>[],
      fields: result.recordset.length > 0 ? Object.keys(result.recordset[0]) : [],
      rowCount: result.rowsAffected?.[0] ?? 0,
    };
  }
}
