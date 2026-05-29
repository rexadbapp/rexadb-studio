# Rexadb Studio — API & Architecture Reference

## Table of Contents

- [Project Overview](#project-overview)
- [Stack & Configuration](#stack--configuration)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Permissions (RBAC)](#permissions-rbac)
- [Default Roles](#default-roles)
- [Library Utilities](#library-utilities)
- [TypeScript Types](#typescript-types)
- [Scripts](#scripts)

---

## Project Overview

Rexadb Studio is a Next.js-based backend admin/studio application for managing database connections (PostgreSQL/MySQL), running SQL queries, managing users/roles/teams, an invite system, a key-value store with granular permissions, and full audit logging.

---

## Stack & Configuration

| Concern | Technology |
|---------|------------|
| **Framework** | Next.js 15.3 (App Router, standalone output) |
| **Language** | TypeScript (ES2022, strict) |
| **Database ORM** | Drizzle ORM 0.42 |
| **Database Engine** | libSQL / Turso (SQLite) — `file:./data/rexadb.db` |
| **Auth** | JWT (`jsonwebtoken`) + bcryptjs + TOTP (`otplib`) |
| **Validation** | Zod |
| **DB Drivers** | `pg` (PostgreSQL), `mysql2` (MySQL) |
| **Container** | Docker (node:22-alpine, multi-stage) |

**Key config files:**

| File | Purpose |
|------|---------|
| `next.config.ts` | Standalone output, CORS on `/api/*`, proxy `/api/studio-proxy/:path*` → `/api/:path*` |
| `drizzle.config.ts` | Drizzle Kit — schema `./src/db/schema.ts`, output `./drizzle`, SQLite dialect |
| `tsconfig.json` | Strict mode, `@/*` → `./src/*`, bundler module resolution |
| `package.json` | Dependencies and scripts (dev, build, start, db:*, setup) |
| `.env` | `DATABASE_URL`, `ENCRYPTION_KEY` (64 hex), `STUDIO_JWT_SECRET` (64 hex), `PORT` |
| `docker-compose.yml` | Single service `rexadb`, port 3000, volume `rexadb-data` |

---

## Authentication

All API endpoints (except login, invite-accept, and avatar serving) require:

```
Authorization: Bearer <studioToken>
```

### Login Flow

```
POST /api/auth/login
  Body: { email, password }
  Response (no TOTP): { studioToken }
  Response (TOTP):    { step: "totp", tempToken }

POST /api/auth/login/totp
  Body: { tempToken, code }
  Response: { studioToken }
```

- `studioToken` — JWT valid for 30 days, signed with `STUDIO_JWT_SECRET`.
- `tempToken` — JWT valid for 5 minutes, used to carry the TOTP step.

### Authentication Library (`src/lib/auth.ts`)

| Function | Description |
|----------|-------------|
| `verifyStudioToken(token)` | Verifies JWT, returns `{ sub, iat, exp }` or null |
| `generateStudioToken(userId)` | Creates 30-day JWT |
| `generateTempToken(userId)` | Creates 5-minute temp JWT |
| `verifyTempToken(token)` | Verifies temp JWT, returns `{ userId }` or null |
| `authenticate(req)` | Extracts Bearer token, verifies, loads user from DB, returns `{ id, email, name, roleId, isActive }` |

---

## API Endpoints

All endpoints return JSON. The standard response shape is:

```typescript
{ data?: T, error?: string, code?: string }
```

### Studio

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/studio` | No | Get the studio instance name — returns `{ name }`. Name is set via `STUDIO_NAME` env var, or auto-generated from `os.hostname()` and persisted in `data/studio.json`. |

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | No | Login with email + password; returns `studioToken` or `{ step: "totp", tempToken }` |
| POST | `/api/auth/login/totp` | No | Complete TOTP second factor |

### Users

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/api/users` | `users.read` | List all users with their roles |
| PATCH | `/api/users/[id]` | `users.manage` | Update user `name`, `email`, `isActive` |
| DELETE | `/api/users/[id]` | `users.manage` | Delete user and their invites |
| PATCH | `/api/users/[id]/role` | `roles.assign` | Assign a role to a user |
| PUT | `/api/users/[id]/avatar` | own ID or `users.manage` | Upload avatar (jpg/png/gif/webp/avif, max 50MB) |
| DELETE | `/api/users/[id]/avatar` | own ID or `users.manage` | Remove avatar |
| GET | `/api/avatars/[filename]` | No | Serve avatar image files |

### Roles

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/api/roles` | `permissions.view` | List all roles with permissions and user counts |
| POST | `/api/roles` | `roles.manage` | Create custom role |
| GET | `/api/roles/[id]` | `permissions.view` | Get single role with permissions and users |
| PUT | `/api/roles/[id]` | `roles.manage` | Update role name/description/permissions |
| DELETE | `/api/roles/[id]` | `roles.manage` | Delete non-system role |

### Permissions

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/api/permissions` | `permissions.view` | List all permission definitions |

### Connections

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/api/connections` | `connections.read` | List connections (all if `connections.manage_access`, else filtered by role) |
| POST | `/api/connections` | `connections.create` | Create connection (password encrypted with AES-256-GCM) |
| GET | `/api/connections/[id]` | `connections.read` | Get connection metadata (no credentials) |
| PUT | `/api/connections/[id]` | `connections.update` | Update connection config |
| DELETE | `/api/connections/[id]` | `connections.delete` | Delete connection |
| GET | `/api/connections/[id]/credentials` | `connections.manage_access` | Get decrypted credentials + connection string |

### Query Execution

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/api/connections/[id]/query` | `queries.execute` or `queries.readonly` | Execute SQL, returns `{ rows, fields, rowCount, duration }`, max 2000 rows, logged to query_logs |

### Saved Queries

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/api/connections/[id]/saved-queries` | `connections.read` | List saved queries for a connection |
| POST | `/api/connections/[id]/saved-queries` | `queries.saved` | Save a new query `{ name, queryText }` |
| PUT | `/api/connections/[id]/saved-queries/[sqId]` | `queries.saved` | Update saved query |
| DELETE | `/api/connections/[id]/saved-queries/[sqId]` | `queries.saved` | Delete saved query |

### Pending Queries (Approval Workflow)

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/api/connections/[id]/pending-queries` | `queries.approve` or team permission | List pending queries |
| POST | `/api/connections/[id]/pending-queries` | — | Submit query for approval (requires `READ_AND_REQUEST` connection access) |
| POST | `/api/connections/[id]/pending-queries/[pqId]/approve` | `queries.approve` or team permission | Approve and execute a pending query |
| POST | `/api/connections/[id]/pending-queries/[pqId]/reject` | `queries.approve` or team permission | Reject a pending query |

### Teams

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/api/teams` | `teams.read` | List teams with member counts |
| POST | `/api/teams` | `teams.create` | Create team (creator becomes admin) |
| GET | `/api/teams/[id]` | `teams.read` | Get team with members and their roles |
| PUT | `/api/teams/[id]` | `teams.update` | Update team name/description |
| DELETE | `/api/teams/[id]` | `teams.delete` | Delete team |
| GET | `/api/teams/[id]/members` | `teams.read` | List team members |
| POST | `/api/teams/[id]/members` | `teams.manage_members` or team admin | Add member |
| DELETE | `/api/teams/[id]/members/[userId]` | `teams.manage_members` or team admin | Remove member |
| GET | `/api/teams/[id]/permissions` | `teams.manage_access` | List team permissions |
| POST | `/api/teams/[id]/permissions` | `teams.manage_access` | Grant permission to team |
| DELETE | `/api/teams/[id]/permissions` | `teams.manage_access` | Revoke team permission |
| GET | `/api/teams/[id]/access` | `teams.manage_access` | List connection access entries for team |
| PUT | `/api/teams/[id]/access` | `teams.manage_access` | Set/update connection access for team |

### Invites

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/api/invites` | `invites.view` | List invites (token hashes excluded) |
| POST | `/api/invites` | `invites.create` | Create invite (returns plain token once; stored as bcrypt hash) |
| POST | `/api/invites/accept` | No auth | Accept invite with token; creates/updates user, returns `studioToken` |
| POST | `/api/invites/[id]/revoke` | `invites.revoke` | Revoke pending invite |

### Key-Value Store

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/api/kv-store` | `kv_store.manage` or per-entry | List accessible KV entries. Query: `?scope=all\|owned\|shared` |
| POST | `/api/kv-store` | `kv_store.create` | Create KV entry with optional permissions |
| GET | `/api/kv-store/[id]` | per-entry or public | Get single KV entry (public entries readable without auth) |
| PUT | `/api/kv-store/[id]` | per-entry (`write_value` / `manage_permissions`) | Update value and/or permissions |
| DELETE | `/api/kv-store/[id]` | per-entry (`delete`) | Delete KV entry |

### Audit & Query Logs

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/api/audit-logs` | `audit_logs.view` | View API audit logs (DB + in-memory buffer) |
| GET | `/api/query-logs` | `query_logs.view` | View query execution logs |

### Proxy Rewrite (next.config.ts)

```
/api/studio-proxy/:path*  →  /api/:path*
```

Allows integration from a main app at a different path prefix.

---

## Database Schema

**16 tables** defined with Drizzle ORM in `src/db/schema.ts`. SQLite via libSQL.

### Table: `roles`

| Column | Type | Notes |
|--------|------|-------|
| id | integer | PK, autoincrement |
| name | text | unique |
| description | text | nullable |
| isSystem | integer | boolean — system roles are undeletable |
| createdAt | text | ISO 8601 |

### Table: `permissions`

| Column | Type | Notes |
|--------|------|-------|
| id | integer | PK, autoincrement |
| code | text | unique, e.g. `"connections.create"` |
| name | text | Human-readable |
| description | text | nullable |
| createdAt | text | ISO 8601 |

### Table: `role_permissions`

Many-to-many join. Composite PK of `(roleId, permissionId)`.

| Column | Type | FK |
|--------|------|----|
| roleId | integer | → roles.id (cascade) |
| permissionId | integer | → permissions.id (cascade) |

### Table: `users`

| Column | Type | Notes |
|--------|------|-------|
| id | text | UUID PK |
| email | text | unique |
| name | text | default `""` |
| roleId | integer | → roles.id |
| isActive | integer | boolean |
| avatarUrl | text | nullable |
| passwordHash | text | nullable |
| totpSecret | text | nullable |
| totpEnabled | integer | boolean, default 0 |
| createdAt | text | ISO 8601 |

### Table: `connections`

| Column | Type | Notes |
|--------|------|-------|
| id | text | UUID PK |
| name | text | |
| type | text | `"postgres"` \| `"mysql"` |
| host | text | |
| port | integer | |
| database | text | |
| username | text | |
| encryptedPassword | text | AES-256-GCM `iv:authTag:ciphertext` |
| ssl | integer | boolean |
| createdBy | text | → users.id |
| createdAt | text | ISO 8601 |
| updatedAt | text | ISO 8601 |

### Table: `connection_access`

| Column | Type | Notes |
|--------|------|-------|
| id | integer | PK, autoincrement |
| connectionId | text | → connections.id (cascade) |
| roleId | integer | nullable, → roles.id |
| teamId | integer | nullable, → teams.id |
| accessType | text | `"FULL_ACCESS"` \| `"READ_ONLY"` \| `"READ_AND_REQUEST"` \| `"CUSTOM"` |
| queryPattern | text | nullable |
| allowedQueryIds | text | nullable, JSON number array |

### Table: `saved_queries`

| Column | Type | Notes |
|--------|------|-------|
| id | integer | PK, autoincrement |
| connectionId | text | → connections.id (cascade) |
| name | text | |
| queryText | text | |
| createdBy | text | → users.id |
| createdAt | text | ISO 8601 |

### Table: `query_logs`

| Column | Type | Notes |
|--------|------|-------|
| id | integer | PK, autoincrement |
| connectionId | text | → connections.id |
| userId | text | → users.id |
| query | text | |
| duration | integer | milliseconds |
| executedAt | text | ISO 8601 |

### Table: `invites`

| Column | Type | Notes |
|--------|------|-------|
| id | integer | PK, autoincrement |
| tokenHash | text | unique, bcrypt hash |
| email | text | |
| roleId | integer | → roles.id |
| status | text | `"PENDING"` \| `"ACCEPTED"` \| `"EXPIRED"` \| `"REVOKED"` |
| expiresAt | text | ISO 8601 |
| createdBy | text | → users.id |
| createdAt | text | ISO 8601 |
| acceptedAt | text | nullable |

### Table: `teams`

| Column | Type | Notes |
|--------|------|-------|
| id | integer | PK, autoincrement |
| name | text | unique |
| description | text | nullable |
| createdBy | text | → users.id |
| createdAt | text | ISO 8601 |
| updatedAt | text | ISO 8601 |

### Table: `team_members`

Composite PK of `(teamId, userId)`.

| Column | Type | Notes |
|--------|------|-------|
| teamId | integer | → teams.id (cascade) |
| userId | text | → users.id (cascade) |
| role | text | `"admin"` \| `"member"` |
| joinedAt | text | ISO 8601 |

### Table: `team_permissions`

Composite PK of `(teamId, permissionCode)`.

| Column | Type | Notes |
|--------|------|-------|
| teamId | integer | → teams.id (cascade) |
| permissionCode | text | e.g. `"queries.approve"` |
| grantedBy | text | → users.id |
| grantedAt | text | ISO 8601 |

### Table: `pending_queries`

| Column | Type | Notes |
|--------|------|-------|
| id | integer | PK, autoincrement |
| connectionId | text | → connections.id |
| teamId | integer | nullable, → teams.id |
| requestedBy | text | → users.id |
| sql | text | |
| params | text | JSON string |
| status | text | `"PENDING"` \| `"APPROVED"` \| `"REJECTED"` |
| approvedBy | text | nullable, → users.id |
| approvedAt | text | nullable |
| createdAt | text | ISO 8601 |

### Table: `kv_store`

| Column | Type | Notes |
|--------|------|-------|
| id | text | UUID PK |
| key | text | |
| value | text | |
| ownerId | text | → users.id |
| createdAt | text | ISO 8601 |
| updatedAt | text | ISO 8601 |

### Table: `kv_store_permissions`

Unique constraint on `(kvId, action, granteeType, granteeId)`.

| Column | Type | Notes |
|--------|------|-------|
| id | integer | PK, autoincrement |
| kvId | text | → kv_store.id (cascade) |
| action | text | `"read"` \| `"write_value"` \| `"manage_permissions"` \| `"delete"` |
| granteeType | text | `"user"` \| `"role"` \| `"team"` \| `"studio"` \| `"public"` |
| granteeId | text | nullable |
| grantedBy | text | → users.id |
| grantedAt | text | ISO 8601 |

### Table: `audit_logs`

| Column | Type | Notes |
|--------|------|-------|
| id | integer | PK, autoincrement |
| ts | integer | Unix epoch ms |
| method | text | |
| url | text | |
| status | integer | |
| reqHeaders | text | nullable, JSON |
| resBody | text | nullable, JSON |
| duration | integer | nullable, ms |
| userId | text | nullable |

---

## Permissions (RBAC)

**27 permission codes** defined across files in `src/permissions/`.

| Code | Name | Category |
|------|------|----------|
| `connections.create` | Create Connections | connections |
| `connections.read` | Read Connections | connections |
| `connections.update` | Update Connections | connections |
| `connections.delete` | Delete Connections | connections |
| `connections.manage_access` | Manage Access | connections |
| `queries.execute` | Execute Queries | queries |
| `queries.readonly` | Read-Only Queries | queries |
| `queries.saved` | Saved Queries | queries |
| `queries.approve` | Approve Queries | teams |
| `users.read` | Read Users | users |
| `users.manage` | Manage Users | users |
| `roles.manage` | Manage Roles | roles |
| `roles.assign` | Assign Roles | roles |
| `permissions.view` | View Permissions | permissions-view |
| `invites.create` | Create Invites | invites |
| `invites.view` | View Invites | invites |
| `invites.revoke` | Revoke Invites | invites |
| `query_logs.view` | View Query Logs | audit |
| `audit_logs.view` | View Audit Logs | audit |
| `teams.create` | Create Teams | teams |
| `teams.read` | Read Teams | teams |
| `teams.update` | Update Teams | teams |
| `teams.delete` | Delete Teams | teams |
| `teams.manage_members` | Manage Members | teams |
| `teams.manage_access` | Manage Team Access | teams |
| `kv_store.create` | Create KV Store Entries | kv-store |
| `kv_store.manage` | Manage KV Store Entries | kv-store |

---

## Default Roles

Defined in `src/config/roles.ts`, seeded by `src/db/seed.ts`.

| Role | Permissions |
|------|-------------|
| **super_admin** | All 27 permissions |
| **admin** | All except `connections.delete`, `roles.manage`, `teams.manage_members`, `teams.manage_access` |
| **developer** | `connections.*`, `queries.*`, `permissions.view`, `kv_store.create` |
| **viewer** | `connections.read`, `queries.readonly`, `permissions.view`, `kv_store.create` |

---

## Library Utilities

### `src/lib/encryption.ts` — AES-256-GCM

```
encrypt(plaintext: string) → string  ("iv:authTag:ciphertext" hex)
decrypt(ciphertext: string) → string
```

Uses `ENCRYPTION_KEY` env var (64 hex chars = 32 bytes).

### `src/lib/bcrypt.ts` — Password Hashing

```
bcrypt.hash(plain: string, saltRounds?: number) → Promise<string>
bcrypt.compare(plain: string, hash: string) → Promise<boolean>
```

### `src/lib/studio-name.ts` — Studio Instance Name

```
getStudioName() → Promise<string>
```

Resolves the studio instance name. Priority:
1. `STUDIO_NAME` env var (if set, cached in memory)
2. `data/studio.json` file (persisted from a previous auto-generation)
3. Auto-generates from `os.hostname()` — strips domain suffix, title-cases, appends ` Studio` (e.g. `flaxo-dev.local` → `Flaxo Dev Studio`), persists to `data/studio.json`

### `src/lib/audit.ts` — Audit Logging

```
auditLog(entry: AuditEntry) → void            // buffered writes (max 500 entries)
getBufferAuditLog() → AuditEntry[]             // returns in-memory buffer
```

### `src/lib/errors.ts` — Error Handling

```
AppError(message, statusCode, code?)           // custom error class
apiResponse(data, status, req?)                // standardized JSON Response with audit
apiError(error, req?)                          // error → JSON Response (handles Zod, AppError, unknown)
```

### `src/lib/rbac.ts` — Role & Access Control

```
requirePermission(userId, code)                                     // throws if role lacks permission
checkConnectionAccess(userId, connectionId, sql)                    // returns { allowed, accessType, queryPattern, allowedQueryIds }
hasTeamPermission(userId, teamId, permissionCode)                   // boolean
requireTeamPermission(userId, teamId, permissionCode)               // throws
canManageTeam(userId, teamId)                                       // boolean
requireTeamAdmin(userId, teamId)                                    // throws
```

### `src/lib/kv-access.ts` — KV Store Access

```
checkKvAccess(kvId, userId, action)              → boolean
requireKvAccess(kvId, userId, action)            // throws AppError
getAccessibleKvIds(userId)                       → string[] (KV entry IDs)
buildAccessPayload(permissions)                  → { read, write_value, manage_permissions, delete }
```

### `src/lib/drivers/index.ts` — Database Driver Factory

```
createDriver(connectionId, type, config)        → DatabaseDriver (PostgresDriver | MySqlDriver)
evictDriverIfAuthError(connectionId, err)       → void
releaseDriver(connectionId)                     → void
releaseAllDrivers()                             → void
```

`DatabaseDriver` interface:

```typescript
interface DatabaseDriver {
  query(sql: string, params?: unknown[]): Promise<QueryResult>
  testConnection(): Promise<void>
  isReadOnlyQuery?(sql: string): boolean
}
```

`QueryResult`: `{ rows: Record<string, unknown>[], fields: string[], rowCount: number }`

### `src/lib/drivers/postgres.ts` — PostgresDriver

Wraps `pg.Pool` (max 3 connections, 60s idle, 10s connect timeout, optional SSL).

### `src/lib/drivers/mysql.ts` — MySqlDriver

Wraps `mysql2/promise` pool (connectionLimit 3, 60s idle, 10s connect timeout, optional SSL).

---

## TypeScript Types

All defined in `src/types/index.ts` (inferred from Drizzle schema) plus local interfaces.

### Drizzle Inferred Types

| Type | Source |
|------|--------|
| `Role` | roles table |
| `NewRole` | roles insert |
| `Permission` | permissions table |
| `NewPermission` | permissions insert |
| `User` | users table |
| `NewUser` | users insert |
| `Connection` | connections table |
| `NewConnection` | connections insert |
| `ConnectionAccess` | connection_access |
| `NewConnectionAccess` | connection_access insert |
| `SavedQuery` | saved_queries |
| `NewSavedQuery` | saved_queries insert |
| `QueryLog` | query_logs |
| `AccessLevel` | `"FULL_ACCESS" \| "READ_ONLY" \| "READ_AND_REQUEST" \| "CUSTOM"` |

### Interfaces

| Interface | Properties |
|-----------|------------|
| `ApiResponse<T>` | `{ data?: T, error?: string, code?: string }` |
| `QueryRequest` | `{ sql: string, params?: unknown[] }` |
| `QueryResponse` | `{ rows: Record<string, unknown>[], fields: string[], rowCount: number, duration: number }` |
| `ConnectionResponse` | `{ id, name, type, host?, port?, database?, username?, ssl, createdBy, createdAt, updatedAt }` |
| `RoleWithPermissions` | `Role` + `permissions: Permission[]` |
| `CreateRoleBody` | `{ name, description?, permissionIds }` |
| `UpdateRoleBody` | `{ name?, description?, permissionIds? }` |
| `SetAccessBody` | `{ roleId, accessType, queryPattern?, allowedQueryIds? }` |
| `CreateConnectionBody` | `{ name, type, host, port, database, username, password, ssl? }` |
| `UpdateConnectionBody` | `{ name?, host?, port?, database?, username?, password?, ssl? }` |
| `CreateSavedQueryBody` | `{ name, queryText }` |
| `UserPayload` | `{ id, email, name, roleId, isActive }` |
| `VerifiedToken` | `{ sub, iat, exp }` |
| `AuditEntry` | `{ ts, method, url, status, reqHeaders?, resBody?, duration?, userId? }` |
| `ConnectionConfig` | `{ host, port, database, username, password, ssl }` |
| `RoleDef` | `{ name, description, isSystem, permissions: string[] }` |
| `PermissionDef` | `{ code, name, description }` |

---

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `setup` | `node setup.mjs` | Interactive: creates .env, installs dep, runs migrations, creates admin |
| `dev` | `next dev` | Start dev server |
| `build` | `next build` | Production build |
| `start` | `next start` | Start production server |
| `db:generate` | `drizzle-kit generate` | Generate migration from schema changes |
| `db:migrate` | `drizzle-kit migrate` | Apply pending migrations |
| `db:seed` | `tsx src/db/seed.ts` | Seed permissions + default roles + admin user |
| `db:create-admin` | `tsx src/db/create-admin.ts` | Create/update admin from env vars |
| `db:studio` | `drizzle-kit studio` | Open Drizzle Studio GUI |
| `typecheck` | `tsc --noEmit` | TypeScript type checking |

---

## Docker Deployment

```yaml
# docker-compose.yml
services:
  rexadb:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - rexadb-data:/app/data
    env_file: .env
```

Entrypoint (`entrypoint.sh`):
1. Creates `/app/data`
2. Runs `drizzle-kit migrate`
3. Optionally creates admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`
4. Starts `node server.js`
