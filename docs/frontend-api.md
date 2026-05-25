# rexadb-studio Full API Reference

> Complete reference for building the frontend. Every endpoint, request shape, response shape, and permission requirement.

---

## Base

```
http://localhost:3000/api
```

## Authentication

All endpoints except `POST /api/invites/accept` require:

```
Authorization: Bearer <studio-jwt>
```

Get a JWT via the invite-accept flow (see **Invites** section). The JWT encodes the user ID and is verified server-side.

## Error Response Format

```json
// Validation error (Zod) — 400
{ "error": "Validation failed", "issues": [{ "code": "too_small", "path": ["name"], "message": "String must contain at least 1 character(s)" }] }

// Business logic error — 400/403/404/409
{ "error": "Connection not found", "code": "ERROR_CODE" }

// Missing permission — 403
{ "error": "Missing required permission: queries.execute" }

// Auth failure — 401
{ "error": "Invalid or expired token" }

// Unhandled error — 500
{ "error": "Internal server error" }
```

## Success Response Format

All successful responses follow:

```json
{ "data": <payload> }
```

The wrapper is always `{ "data": ... }` except for `GET /api/auth` which returns `{ "user": ... }` directly.

---

## Domain: Auth

### `GET /api/auth`

Verify the current token and return the authenticated user.

**Permission:** None (any authenticated user)

**Response:**
```json
{ "user": { "id": "uuid", "email": "user@example.com", "name": "User", "roleId": 1, "isActive": true, "createdAt": "2026-05-21T09:28:55.261Z" } }
```

### `GET /api/auth/me`

Get the current user's profile with role and resolved permissions.

**Permission:** None (any authenticated user)

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User",
    "role": { "id": 1, "name": "super_admin", "description": "..." } | null,
    "permissions": [
      { "code": "connections.create", "name": "Create Connections" },
      { "code": "queries.execute", "name": "Execute Queries" }
    ]
  }
}
```

**Important for frontend:** Call this on app load to get the user's permissions. Use `permissions` array to enable/disable UI elements.

---

## Domain: Permissions

### `GET /api/permissions`

List all available permission codes in the system.

**Permission:** `permissions.view`

**Response:**
```json
{
  "data": [
    { "id": 1, "code": "connections.create", "name": "Create Connections", "description": "Create new database connections", "createdAt": "..." },
    { "id": 2, "code": "connections.read", "name": "Read Connections", "description": "View connection metadata", "createdAt": "..." }
  ]
}
```

---

## Domain: Roles

### `GET /api/roles`

List all roles with their permissions and user count.

**Permission:** `permissions.view`

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "super_admin",
      "description": "Unrestricted access to all resources and settings",
      "isSystem": true,
      "createdAt": "...",
      "rolePermissions": [ { "id": 1, "roleId": 1, "permissionId": 1, "permission": { ... } } ],
      "users": [ { "id": "uuid", "email": "user@example.com", "name": "User" } ],
      "permissions": [ { "id": 1, "code": "connections.create", "name": "Create Connections", ... } ],
      "userCount": 5
    }
  ]
}
```

### `POST /api/roles`

Create a custom (non-system) role.

**Permission:** `roles.manage`

**Body:**
```json
{ "name": "analyst", "description": "Can run analytics queries", "permissionIds": [1, 2, 3] }
```

**Response (201):**
```json
{ "data": { "id": 6, "name": "analyst", "description": "Can run analytics queries", "isSystem": false, "createdAt": "..." } }
```

**Errors:** 409 if name taken.

### `GET /api/roles/[id]`

Get a single role with permissions and users.

**Permission:** `permissions.view`

**Response:**
```json
{
  "data": {
    "id": 1,
    "name": "super_admin",
    "rolePermissions": [ ... ],
    "users": [ ... ],
    "permissions": [ ... ]
  }
}
```

### `PUT /api/roles/[id]`

Update a role's name, description, or permission set.

**Permission:** `roles.manage`

**Body:**
```json
{ "name": "new-name", "description": "new desc", "permissionIds": [1, 2, 4, 5] }
```

All fields optional. If `permissionIds` is provided, it **replaces** the entire permission set.

**Response:**
```json
{ "data": { "id": 1, "name": "new-name", "description": "new desc", "rolePermissions": [...], "permissions": [...] } }
```

### `DELETE /api/roles/[id]`

Delete a custom role.

**Permission:** `roles.manage`

**Response:**
```json
{ "data": { "success": true } }
```

**Errors:** 403 if role is system (`isSystem: true`).

---

## Domain: Connections

### `GET /api/connections`

List accessible connections. If user has `connections.manage_access`, returns **all** connections. Otherwise, returns only connections where user's role has been granted access.

**Permission:** `connections.read`

**Response:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Production DB",
      "type": "postgres",
      "host": "db.example.com",
      "port": 5432,
      "database": "mydb",
      "username": "app_user",
      "ssl": true,
      "createdBy": "uuid",
      "createdAt": "2026-05-21T09:28:55.261Z",
      "updatedAt": "2026-05-21T09:28:55.261Z"
    }
  ]
}
```

**Password is never returned.**

### `POST /api/connections`

Create a new database connection. Password is encrypted at rest.

**Permission:** `connections.create`

**Body:**
```json
{
  "name": "Production DB",
  "type": "postgres",   // "postgres" | "mysql"
  "host": "db.example.com",
  "port": 5432,
  "database": "mydb",
  "username": "app_user",
  "password": "s3cret",
  "ssl": false
}
```

**Response (201):** Same shape as GET (without password).

### `GET /api/connections/[id]`

Get a single connection's metadata.

**Permission:** `connections.read`

**Response:** Same shape as list item.

### `PUT /api/connections/[id]`

Update connection fields. All fields optional.

**Permission:** `connections.update`

**Body:**
```json
{ "name": "New Name", "host": "newhost.com", "port": 5432, "database": "newdb", "username": "newuser", "password": "newpass", "ssl": true }
```

**Response:** Updated connection (without password).

### `DELETE /api/connections/[id]`

Delete a connection.

**Permission:** `connections.delete`

**Response:**
```json
{ "data": { "success": true } }
```

---

## Domain: Connection Access (Role-based)

Controls which **roles** can access which connections and at what level.

### `GET /api/connections/[id]/access`

List all role-based access entries for a connection.

**Permission:** `connections.manage_access`

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "connectionId": "uuid",
      "roleId": 2,
      "accessType": "READ_ONLY",
      "queryPattern": null,
      "allowedQueryIds": null,
      "role": { "id": 2, "name": "admin", "description": "..." }
    }
  ]
}
```

### `PUT /api/connections/[id]/access`

Set role-based access for a connection (upsert — creates or updates).

**Permission:** `connections.manage_access`

**Body:**
```json
{
  "roleId": 2,
  "accessType": "FULL_ACCESS",      // "FULL_ACCESS" | "READ_ONLY" | "CUSTOM"
  "queryPattern": null,               // regex pattern for CUSTOM type
  "allowedQueryIds": [1, 2, 3]        // saved query IDs for CUSTOM type
}
```

**Response:** The created/updated entry.

---

## Domain: Connection Access (Team-based)

See **Domain: Teams** section for team-level access management.

---

## Domain: Query Execution

### `POST /api/connections/[id]/query`

Execute SQL against a database connection. The core proxy endpoint.

**Permission:** Requires at least one of `queries.execute` or `queries.readonly`. If only `queries.readonly`, see access-type enforcement below.

**Body:**
```json
{ "sql": "SELECT * FROM users LIMIT 10", "params": [] }
```

**Response:**
```json
{
  "data": {
    "rows": [ { "id": 1, "email": "..." } ],
    "fields": [ { "name": "id", "dataTypeID": 23 }, { "name": "email", "dataTypeID": 1043 } ],
    "rowCount": 10,
    "duration": 12
  }
}
```

### Access-level enforcement flow (server-side):

1. If user has `connections.manage_access` → **FULL_ACCESS** (skips per-connection checks)
2. Fetch `connection_access` for the user's role
3. If no access entry → 403
4. Check `accessType`:
   - **`FULL_ACCESS`**: any SQL allowed
   - **`READ_ONLY`**: only `SELECT / WITH / EXPLAIN / DESCRIBE / SHOW` allowed
   - **`CUSTOM`**: check against `queryPattern` regex OR if SQL matches a saved query in `allowedQueryIds`
5. If user's role has no access entry, fall back to **team-based access** (check `connection_access` for teams the user belongs to)

---

## Domain: Saved Queries

Predefined query templates attached to a connection.

### `GET /api/connections/[id]/saved-queries`

**Permission:** `connections.read`

**Response:**
```json
{
  "data": [
    { "id": 1, "connectionId": "uuid", "name": "Get Users", "queryText": "SELECT * FROM users", "createdBy": "uuid", "createdAt": "..." }
  ]
}
```

### `POST /api/connections/[id]/saved-queries`

**Permission:** `queries.saved`

**Body:**
```json
{ "name": "Get Users", "queryText": "SELECT * FROM users" }
```

**Response (201):** The created saved query.

### `PUT /api/connections/[id]/saved-queries/[sqId]`

**Permission:** `queries.saved`

**Body:**
```json
{ "name": "New Name", "queryText": "SELECT id, email FROM users" }
```

**Response:** Updated saved query.

### `DELETE /api/connections/[id]/saved-queries/[sqId]`

**Permission:** `queries.saved`

**Response:**
```json
{ "data": { "success": true } }
```

---

## Domain: Users

### `GET /api/users`

List all users with their role.

**Permission:** `users.read`

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "flaxo.dev@gmail.com",
      "name": "Flaxo",
      "roleId": 1,
      "isActive": true,
      "createdAt": "...",
      "role": { "id": 1, "name": "super_admin", "description": "..." }
    }
  ]
}
```

### `PATCH /api/users/[id]`

Update user profile fields.

**Permission:** `users.manage`

**Body:**
```json
{ "name": "New Name", "email": "new@example.com", "isActive": false }
```

**Response:**
```json
{ "data": { "success": true } }
```

### `DELETE /api/users/[id]`

Delete a user and their invites.

**Permission:** `users.manage`

**Response:**
```json
{ "data": { "success": true } }
```

### `PATCH /api/users/[id]/role`

Change a user's role assignment.

**Permission:** `roles.assign`

**Body:**
```json
{ "roleId": 2 }
```

**Response:**
```json
{ "data": { "success": true } }
```

---

## Domain: Invites

Invite-based onboarding flow. Used when your main app wants to grant a user access to the studio.

### `POST /api/invites`

Generate an invite for a user. Returns the plaintext token **once**.

**Permission:** `invites.create`

**Body:**
```json
{ "email": "user@example.com", "roleId": 1 }
```

`roleId` is optional (defaults to viewer role, id=1).

**Response (201):**
```json
{
  "data": {
    "id": 1,
    "email": "user@example.com",
    "token": "a1b2c3...64-hex-chars...",
    "expiresAt": "2026-05-29T10:00:00.000Z"
  }
}
```

### `POST /api/invites/accept`

Accept an invite using the plaintext token. **No Bearer token required** — auth is the invite token itself. Called by your main app on behalf of the user.

**Permission:** None (public)

**Body:**
```json
{ "token": "a1b2c3...64-hex-chars...", "name": "John Doe", "email": "user@example.com" }
```

**Response:**
```json
{ "data": { "userId": "uuid", "studioToken": "jwt..." } }
```

**Important:** Store `studioToken` securely. Use it as `Authorization: Bearer <studioToken>` for all subsequent API calls.

### `GET /api/invites`

List all invites.

**Permission:** `invites.view`

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "email": "user@example.com",
      "status": "PENDING",    // "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED"
      "expiresAt": "...",
      "createdAt": "...",
      "acceptedAt": null,
      "createdBy": { "id": "uuid", "email": "admin@example.com", "name": "Admin" }
    }
  ]
}
```

### `POST /api/invites/[id]/revoke`

Revoke a pending invite.

**Permission:** `invites.revoke`

**Response:**
```json
{ "data": { "success": true } }
```

**Errors:** 400 if invite is not PENDING.

---

## Domain: Teams

Teams allow grouping users to share connection access and approval permissions. A team has:
- **`admin`** — manages members, automatically inherits all team-scoped permissions
- **`member`** — has only explicitly granted team permissions

### `GET /api/teams`

List all teams with member count.

**Permission:** `teams.read`

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Engineering",
      "description": "Engineering team",
      "createdBy": "uuid",
      "createdAt": "...",
      "updatedAt": "...",
      "memberCount": 5
    }
  ]
}
```

### `POST /api/teams`

Create a team. The creator is automatically added as an `admin` member.

**Permission:** `teams.create`

**Body:**
```json
{ "name": "Engineering", "description": "Engineering team" }
```

**Response (201):**
```json
{ "data": { "id": 1, "name": "Engineering", "description": "Engineering team", "createdBy": "uuid", "createdAt": "...", "updatedAt": "..." } }
```

### `GET /api/teams/[id]`

Get team details with members.

**Permission:** `teams.read`

**Response:**
```json
{
  "data": {
    "id": 1,
    "name": "Engineering",
    "description": "Engineering team",
    "createdBy": "uuid",
    "createdAt": "...",
    "updatedAt": "...",
    "members": [
      {
        "teamId": 1,
        "userId": "uuid",
        "role": "admin",         // "admin" | "member"
        "joinedAt": "...",
        "user": { "id": "uuid", "email": "user@example.com", "name": "User" }
      }
    ]
  }
}
```

### `PUT /api/teams/[id]`

Update team name/description.

**Permission:** `teams.update`

**Body:**
```json
{ "name": "New Name", "description": "New description" }
```

**Response:** Updated team.

### `DELETE /api/teams/[id]`

Delete a team.

**Permission:** `teams.delete`

**Response:**
```json
{ "data": { "success": true } }
```

---

### Team Members

### `GET /api/teams/[id]/members`

List team members with user info.

**Permission:** `teams.read`

**Response:**
```json
{
  "data": [
    {
      "teamId": 1,
      "userId": "uuid",
      "role": "admin",
      "joinedAt": "...",
      "user": { "id": "uuid", "email": "user@example.com", "name": "User" }
    }
  ]
}
```

### `POST /api/teams/[id]/members`

Add a member to a team.

**Permission:** `teams.manage_members` (global) OR be a team admin (`role: "admin"` in the team)

**Body:**
```json
{ "userId": "uuid", "role": "member" }
```

`role` is optional (defaults to `"member"`).

**Response (201):**
```json
{ "data": { "teamId": 1, "userId": "uuid", "role": "member", "joinedAt": "..." } }
```

### `DELETE /api/teams/[id]/members/[userId]`

Remove a member from a team.

**Permission:** `teams.manage_members` (global) OR be a team admin

**Response:**
```json
{ "data": { "success": true } }
```

---

### Team Connection Access

### `GET /api/teams/[id]/access`

List team-based connection access entries.

**Permission:** `teams.manage_access`

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "connectionId": "uuid",
      "teamId": 1,
      "accessType": "READ_ONLY",       // "FULL_ACCESS" | "READ_ONLY" | "READ_AND_REQUEST" | "CUSTOM"
      "queryPattern": null,
      "allowedQueryIds": null,
      "connection": { "id": "uuid", "name": "Production DB" }
    }
  ]
}
```

### `PUT /api/teams/[id]/access`

Grant or update team-level connection access (upsert).

**Permission:** `teams.manage_access`

**Body:**
```json
{
  "connectionId": "uuid",
  "accessType": "FULL_ACCESS",     // "FULL_ACCESS" | "READ_ONLY" | "READ_AND_REQUEST" | "CUSTOM"
  "queryPattern": null,
  "allowedQueryIds": [1, 2]
}
```

**Response:** The created/updated entry.

---

### Team Permissions

Team-scoped permissions override or supplement role-based permissions. Currently relevant permission codes:

| Code | Effect |
|---|---|
| `queries.approve` | Team member can approve/reject pending queries for this team |

Team admins (`role: "admin"`) implicitly have all team-scoped permissions.

### `GET /api/teams/[id]/permissions`

List team-level permission grants.

**Permission:** `teams.manage_access`

**Response:**
```json
{
  "data": [
    { "id": 1, "teamId": 1, "permissionCode": "queries.approve", "grantedBy": "uuid", "grantedAt": "..." }
  ]
}
```

### `POST /api/teams/[id]/permissions`

Grant a permission to a team.

**Permission:** `teams.manage_access`

**Body:**
```json
{ "permissionCode": "queries.approve" }
```

**Response (201):** The created permission entry.

### `DELETE /api/teams/[id]/permissions`

**Body:**
```json
{ "permissionCode": "queries.approve" }
```

**Response:**
```json
{ "data": { "success": true } }
```

---

## Domain: Pending Queries (Approval Workflow)

The `READ_AND_REQUEST` access type allows users to submit queries that execute only after approval.

### `POST /api/connections/[id]/pending-queries`

Submit a query for approval.

**Permission:** User must have `READ_AND_REQUEST` access to the connection (via role or team membership).

**Body:**
```json
{
  "sql": "DELETE FROM users WHERE id = 1",
  "params": [],
  "teamId": 1
}
```

`teamId` is optional. If provided, the query is routed to that team's approval queue. User must be a member of the specified team.

**Response (201):**
```json
{
  "data": {
    "id": 1,
    "connectionId": "uuid",
    "teamId": 1,
    "requestedBy": "uuid",
    "sql": "DELETE FROM users WHERE id = 1",
    "params": null,
    "status": "PENDING",
    "createdAt": "..."
  }
}
```

### `GET /api/connections/[id]/pending-queries`

List pending queries for a connection.

**Permission:** User must have global `queries.approve` OR the query's team must have `queries.approve` team permission AND user must be on that team.

**Important logic:** If user has global `queries.approve`, returns ALL pending queries for the connection. Otherwise, filters to teams where user is a member AND that team has the `queries.approve` permission.

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "connectionId": "uuid",
      "teamId": 1,
      "requestedBy": "uuid",
      "sql": "DELETE FROM users WHERE id = 1",
      "params": null,
      "status": "PENDING",
      "createdAt": "...",
      "approvedBy": null,
      "approvedAt": null,
      "requestedByUser": { "id": "uuid", "email": "requester@example.com", "name": "Requester" }
    }
  ]
}
```

### `POST /api/connections/[id]/pending-queries/[pqId]/approve`

Approve and execute a pending query. The SQL is run against the connection.

**Permission:** Same as GET (global `queries.approve` or team-level `queries.approve` + membership)

**Important:** Team-level approval only works if the pending query has a `teamId`. Queries without `teamId` can only be approved by users with global `queries.approve`.

**Response:** Same shape as `POST /query`:
```json
{
  "data": {
    "rows": [],
    "fields": [],
    "rowCount": 0,
    "duration": 5
  }
}
```

### `POST /api/connections/[id]/pending-queries/[pqId]/reject`

Reject a pending query (does NOT execute it).

**Permission:** Same as approve.

**Response:**
```json
{ "data": { "success": true } }
```

---

## Domain: Query Logs

### `GET /api/query-logs`

View the execution history (last 200 queries).

**Permission:** `query_logs.view`

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "connectionId": "uuid",
      "userId": "uuid",
      "query": "SELECT * FROM users",
      "duration": 12,
      "executedAt": "...",
      "connection": { "id": "uuid", "name": "Production DB", "type": "postgres" },
      "user": { "id": "uuid", "email": "user@example.com", "name": "User" }
    }
  ]
}
```

---

## Domain: Audit Logs

### `GET /api/audit-logs`

View all API call audit entries (last 200). Every `apiResponse` / `apiError` call writes to this table.

**Permission:** `audit_logs.view`

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "ts": 1747800000000,
      "method": "GET",
      "url": "/api/connections",
      "status": 200,
      "reqHeaders": { "authorization": "Bearer ey...", "content-type": "application/json" },
      "resBody": { "data": [...] },
      "duration": 45
    }
  ]
}
```

---

## Permission Model

### All 25 Permission Codes

```
connections.create      Create Connections
connections.read        Read Connections
connections.update      Update Connections
connections.delete      Delete Connections
connections.manage_access   Manage Access (to connections)

queries.execute         Execute Queries (any SQL)
queries.readonly        Read-Only Queries (SELECT/WITH/EXPLAIN/DESCRIBE/SHOW)
queries.saved           Saved Queries (CRUD on saved query templates)
queries.approve         Approve Queries (approve/reject pending queries)

users.read              Read Users
users.manage            Manage Users (update/delete users)

roles.manage            Manage Roles (CRUD on roles)
roles.assign            Assign Roles (change user's roleId)

permissions.view        View Permissions (list permissions/roles)

invites.create          Create Invites
invites.view            View Invites
invites.revoke          Revoke Invites

teams.create            Create Teams
teams.read              Read Teams
teams.update            Update Teams
teams.delete            Delete Teams
teams.manage_members    Manage Team Members
teams.manage_access     Manage Team Access (connection access + team perms)

query_logs.view         View Query Logs
audit_logs.view         View Audit Logs
```

### Default Roles & Their Permissions

| Role | Includes | Excludes |
|---|---|---|
| **super_admin** (id=1) | ALL 25 permissions | — |
| **admin** (id=2) | Everything except: | `connections.delete`, `roles.manage`, `teams.manage_members`, `teams.manage_access` |
| **developer** (id=3) | `connections.*`, `queries.execute`, `queries.readonly`, `queries.saved`, `permissions.view` | — |
| **viewer** (id=4) | `connections.read`, `queries.readonly`, `permissions.view` | — |

### Connection-Level Access Types

Applied per connection in `connection_access` table (role-level or team-level):

| Access Type | Behavior |
|---|---|
| `FULL_ACCESS` | Any SQL allowed |
| `READ_ONLY` | Only `SELECT / WITH / EXPLAIN / DESCRIBE / SHOW` |
| `CUSTOM` | Check `queryPattern` regex OR `allowedQueryIds` (saved queries) |
| `READ_AND_REQUEST` | **New** — SELECT queries run immediately, DML/DDL go to pending queue for approval |

### Team Permission Inheritance

- Team `admin` (role in `team_members`): automatically has ALL team-scoped permissions (currently `queries.approve`)
- Team `member`: only has team permissions explicitly granted via `team_permissions` table
- Global permission `queries.approve` always overrides team scope (user can approve ANY pending query)

---

## Business Logic Summary for Frontend

1. **On app load**: call `GET /api/auth/me` — get user profile + resolved permissions array. Use this to gate UI.
2. **Connections list**: shows only connections user can access. If user lacks `connections.manage_access`, they only see connections where their role (or team) has been granted access.
3. **Query execution**: `POST /api/connections/[id]/query`. If user has `queries.readonly` only, SELECT-only queries work. If `READ_AND_REQUEST` access, the UI should show a "Submit for Approval" flow instead of direct execution.
4. **Teams** enable collaborative connection access. An admin creates a team, adds members, grants connection access to the team, and optionally grants `queries.approve` permission to team members.
5. **Approval workflow**: users with `READ_AND_REQUEST` access submit queries via `POST .../pending-queries`. Users with global or team-level `queries.approve` see them in `GET .../pending-queries` and can approve (= execute) or reject.
6. **Invite flow**: your main app calls `POST /api/invites` (returns token once), delivers token to user, user calls `POST /api/invites/accept` (no auth), gets back `studioToken`. Store this token for all subsequent API calls.
