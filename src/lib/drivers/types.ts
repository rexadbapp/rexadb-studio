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
}


