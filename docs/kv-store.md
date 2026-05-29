# KV Store API

A generic key-value store with per-entry, per-action granular permissions.
Every entry has an **owner** (creator) who automatically has full access.
Access can be granted for each of 4 actions independently to any combination of
**users**, **roles**, **teams**, **all studio members**, or **the public**.

---

## Database Tables

### `kv_store`

| Column       | Type   | Notes                         |
|--------------|--------|-------------------------------|
| `id`         | TEXT   | UUID (primary key)            |
| `key`        | TEXT   | User-chosen name              |
| `value`      | TEXT   | Stored content (any text)     |
| `owner_id`   | TEXT   | FK → `users.id`               |
| `created_at` | TEXT   | ISO timestamp                  |
| `updated_at` | TEXT   | ISO timestamp                  |

Unique constraint on `(owner_id, key)` — each user has their own key namespace.

### `kv_store_permissions`

| Column         | Type    | Notes                                      |
|----------------|---------|--------------------------------------------|
| `id`           | INTEGER | PK auto-increment                           |
| `kv_id`        | TEXT    | FK → `kv_store.id` (CASCADE on delete)      |
| `action`       | TEXT    | `read` / `write_value` / `manage_permissions` / `delete` |
| `grantee_type` | TEXT    | `user` / `role` / `team` / `studio` / `public` |
| `grantee_id`   | TEXT    | ID of user/role/team (nullable for `studio`/`public`) |
| `granted_by`   | TEXT    | FK → `users.id`                            |
| `granted_at`   | TEXT    | ISO timestamp                               |

Unique constraint on `(kv_id, action, grantee_type, grantee_id)`.

---

## Actions (4 grantable perms)

| Action              | Allows                                   |
|---------------------|------------------------------------------|
| `read`              | View the entry and its permissions        |
| `write_value`       | Update `key` or `value`                   |
| `manage_permissions`| Add/remove any grantee for any action     |
| `delete`            | Delete the entry completely               |

The **owner** implicitly has all four. Everyone else needs an explicit grant row.

Global permission `kv_store.manage` (RBAC) acts as an admin override — users with it
bypass all per-entry checks on every action.

---

## Endpoints

### `POST /api/kv-store`

Create a new entry. Requires global `kv_store.create` permission.

**Request body:**

```json
{
  "key": "my-config",
  "value": "some value or JSON string",
  "permissions": [
    { "action": "read",              "type": "team",  "id": "1" },
    { "action": "read",              "type": "public" },
    { "action": "write_value",       "type": "user",  "id": "abc-123" },
    { "action": "manage_permissions","type": "role",  "id": "2" },
    { "action": "delete",            "type": "user",  "id": "def-456" }
  ]
}
```

`permissions` is optional and defaults to `[]` (only the owner can access).

**Response** `201 Created`:

```json
{
  "data": {
    "id": "uuid-here",
    "key": "my-config",
    "value": "some value or JSON string",
    "ownerId": "owner-uuid",
    "permissions": {
      "read":              [{ "type": "team", "id": "1" }, { "type": "public" }],
      "write_value":       [{ "type": "user", "id": "abc-123" }],
      "manage_permissions":[{"type": "role", "id": "2"}],
      "delete":            [{ "type": "user", "id": "def-456" }]
    },
    "createdAt": "2026-05-27T...",
    "updatedAt": "2026-05-27T..."
  }
}
```

---

### `GET /api/kv-store`

List entries the authenticated user owns or has `read` access to.

**Query params:**

| Param   | Values                                    | Default |
|---------|-------------------------------------------|---------|
| `scope` | `all` / `owned` / `shared`               | `all`   |

**Response** `200 OK`:

```json
{
  "data": [
    {
      "id": "uuid",
      "key": "my-config",
      "value": "...",
      "ownerId": "owner-uuid",
      "permissions": { "read": [], "write_value": [], "manage_permissions": [], "delete": [] },
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

Users with `kv_store.manage` (global RBAC) see **all** entries.

---

### `GET /api/kv-store/:id`

Get a single entry. Respects per-entry `read` grants.

- If the entry has a `public` read grant, this endpoint works **without authentication**.
- Otherwise requires authentication and a matching `read` grant (or `kv_store.manage`).

**Response** `200 OK`: Same shape as individual entry above.

---

### `PUT /api/kv-store/:id`

Update the value and/or permissions of an entry.

- Updating `key` or `value` requires `write_value` grant (or owner).
- Updating `permissions` requires `manage_permissions` grant (or owner).
- You can send both value fields and permissions in a single request.
- An empty `"permissions": []` **clears all existing grants**.

**Request body** (any combination):

```json
{
  "key": "new-key-name",
  "value": "new value",
  "permissions": [
    { "action": "read", "type": "public" }
  ]
}
```

**Response** `200 OK`: Returns the updated entry with full permission snapshot.

---

### `DELETE /api/kv-store/:id`

Delete an entry. Requires `delete` grant (or owner, or `kv_store.manage`).

**Response** `200 OK`:

```json
{ "data": { "success": true } }
```

---

## Permission grantee types

| `type`    | `id` required | Meaning                               |
|-----------|---------------|---------------------------------------|
| `user`    | yes           | A specific user (UUID)                |
| `role`    | yes           | A role (integer ID)                   |
| `team`    | yes           | A team (integer ID)                   |
| `studio`  | no            | Any authenticated studio member       |
| `public`  | no            | Anyone, no auth required              |

---

## Error codes

| Status | Meaning                                                       |
|--------|---------------------------------------------------------------|
| 401    | Missing or invalid auth token (when required)                 |
| 403    | Missing permission for this action on this entry              |
| 404    | Entry not found                                               |
| 409    | Key conflict (you already have an entry with this key)        |
| 422    | Validation error (bad field types, missing required fields)   |
