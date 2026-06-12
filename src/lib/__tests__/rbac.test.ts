import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdtempSync, unlinkSync, rmdirSync } from 'fs'
import { createClient } from '@libsql/client'
import crypto from 'node:crypto'

let testDir: string
let dbPath: string
let testUserId: string
let testConnectionId: string

beforeAll(async () => {
  testDir = mkdtempSync(join(tmpdir(), 'rexadb-rbac-test-'))
  dbPath = join(testDir, 'test.db')
  process.env.DATABASE_URL = `file:${dbPath}`

  const client = createClient({ url: process.env.DATABASE_URL })
  const now = new Date().toISOString()

  await client.batch([
    // tables needed for the test
    `CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '' NOT NULL,
      is_system INTEGER DEFAULT 0 NOT NULL,
      created_at TEXT DEFAULT '' NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      name TEXT DEFAULT '' NOT NULL,
      role_id INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1 NOT NULL,
      created_at TEXT DEFAULT '' NOT NULL,
      FOREIGN KEY (role_id) REFERENCES roles(id)
    )`,
    `CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      database TEXT NOT NULL,
      username TEXT NOT NULL,
      encrypted_password TEXT NOT NULL,
      ssl INTEGER DEFAULT 0 NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT '' NOT NULL,
      updated_at TEXT DEFAULT '' NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS saved_queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      connection_id TEXT NOT NULL,
      name TEXT NOT NULL,
      query_text TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT '' NOT NULL,
      FOREIGN KEY (connection_id) REFERENCES connections(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS connection_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      connection_id TEXT NOT NULL,
      role_id INTEGER,
      team_id INTEGER,
      access_type TEXT NOT NULL,
      query_pattern TEXT,
      allowed_query_ids TEXT,
      FOREIGN KEY (connection_id) REFERENCES connections(id),
      FOREIGN KEY (role_id) REFERENCES roles(id)
    )`,
    `CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      PRIMARY KEY(role_id, permission_id)
    )`,
    `CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT '' NOT NULL
    )`,
  ])

  testConnectionId = crypto.randomUUID()
  testUserId = crypto.randomUUID()

  // seed a role
  await client.execute({
    sql: `INSERT INTO roles (name, description, is_system, created_at) VALUES (?, ?, ?, ?)`,
    args: ['test_role', 'Test role', 0, now],
  })
  const { rows: roleRows } = await client.execute({
    sql: `SELECT id FROM roles WHERE name = ?`,
    args: ['test_role'],
  })
  const roleId = Number(roleRows[0]!.id)

  // seed a user with that role (no special permissions)
  await client.execute({
    sql: `INSERT INTO users (id, email, name, role_id, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [testUserId, 'test@test.com', 'Test User', roleId, 1, now],
  })

  // seed a connection
  await client.execute({
    sql: `INSERT INTO connections (id, name, type, host, port, database, username, encrypted_password, ssl, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [testConnectionId, 'test', 'postgres', 'localhost', 5432, 'testdb', 'testuser', 'encrypted', 0, testUserId, now, now],
  })

  // seed a saved query
  await client.execute({
    sql: `INSERT INTO saved_queries (connection_id, name, query_text, created_by, created_at) VALUES (?, ?, ?, ?, ?)`,
    args: [testConnectionId, 'test_query', 'SELECT 1', testUserId, now],
  })
  const { rows: sqRows } = await client.execute({
    sql: `SELECT id FROM saved_queries WHERE name = ?`,
    args: ['test_query'],
  })
  const savedQueryId = Number(sqRows[0]!.id)

  // seed connection_access: CUSTOM type with allowedQueryIds pointing at the saved query
  await client.execute({
    sql: `INSERT INTO connection_access (connection_id, role_id, access_type, allowed_query_ids) VALUES (?, ?, 'CUSTOM', ?)`,
    args: [testConnectionId, roleId, JSON.stringify([savedQueryId])],
  })

  client.close()
})

afterAll(() => {
  try { unlinkSync(dbPath) } catch { /* ok */ }
  try { rmdirSync(testDir) } catch { /* ok */ }
})

describe('checkConnectionAccess — CUSTOM access type with allowedQueryIds', () => {

  it('ALLOWS SQL that matches the saved query', async () => {
    const { checkConnectionAccess } = await import('@/lib/rbac')
    const result = await checkConnectionAccess(testUserId, testConnectionId, 'SELECT 1')
    expect(result.allowed).toBe(true)
  })

  it('DENIES SQL that does NOT match the saved query — reproduces the bug', async () => {
    const { checkConnectionAccess } = await import('@/lib/rbac')
    const result = await checkConnectionAccess(testUserId, testConnectionId, 'SELECT * FROM users')
    // The saved query says 'SELECT 1', but we're executing 'SELECT * FROM users'
    // This should be DENIED because the SQL doesn't match.
    // BUG: the current code only checks if a saved query with an allowed ID exists,
    //      it never compares the incoming sql against savedQuery.queryText.
    expect(result.allowed).toBe(false)
  })

})
