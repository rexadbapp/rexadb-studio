# rexadb-studio

> Backend API server for the rexadb database client GUI. Proxies database connections through a central API with role-based access control (RBAC), so admins can grant team members scoped access to databases without exposing credentials.

## Quick Start

```sh
cp .env.example .env
npm install
npx drizzle-kit migrate
npx tsx src/db/seed.ts
npm run dev        # http://localhost:3000
```

Or with Docker:

```sh
docker compose up -d
```

## Architecture Overview

```
Client App → POST /query (Bearer token) → rexadb-studio
  ├── Verify Supabase JWT
  ├── Check RBAC permissions
  ├── Decrypt stored credentials (AES-256-GCM)
  ├── Connect via driver (pg / mysql2)
  ├── Execute query
  ├── Log audit trail
  └── Return rows + fields
```

| Layer | Description |
|-------|-------------|
| `src/app/api/` | Thin route handlers |
| `src/lib/auth.ts` | Auth adapter (Supabase, swappable) |
| `src/lib/rbac.ts` | Permission & connection-level access checks |
| `src/lib/drivers/` | Pluggable database drivers (Postgres, MySQL) |
| `src/lib/encryption.ts` | AES-256-GCM credential encryption |
| `src/db/` | Drizzle ORM schema + SQLite app storage |
| `src/config/` | Permission codes & default role definitions |

## Supported Databases

- **Postgres** (via `pg`)
- **MySQL** (via `mysql2`)
- Extensible — implement `DatabaseDriver` and use `registerDriver()`

## Permissions

Granular permission system with built-in roles (`super_admin`, `admin`, `developer`, `viewer`) and connection-level access types (`FULL_ACCESS`, `READ_ONLY`, `CUSTOM`). Custom roles can be created at runtime.

## Docs

- [Architecture & API Reference](docs/architecture.md)
- [Users API](docs/users-api.md)
- [Frontend API Integration](docs/frontend-api.md)
- [Integrate with Main App](docs/integrate-with-main-app.md)

## Tech Stack

**Next.js** (App Router), **Drizzle ORM** + **libSQL** (SQLite), **Supabase** (auth), **pg** / **mysql2** (drivers), **Zod** (validation), **AES-256-GCM** (encryption).
