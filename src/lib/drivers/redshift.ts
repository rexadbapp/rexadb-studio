import { PostgresDriver } from './postgres';
import type { ConnectionConfig, QueryResult } from './types';

export class RedshiftDriver extends PostgresDriver {
  constructor(config: ConnectionConfig) {
    super(config);
  }
}
