import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

let _db: LibSQLDatabase<typeof schema> | null = null;

function init(): LibSQLDatabase<typeof schema> {
  const url = process.env.DATABASE_URL ?? 'file:./data/rexadb.db';
  const client = createClient({ url });
  return drizzle(client, { schema });
}

export function getDb(): LibSQLDatabase<typeof schema> {
  if (!_db) _db = init();
  return _db;
}
