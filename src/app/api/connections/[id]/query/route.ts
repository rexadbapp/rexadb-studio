import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { connections, queryLogs, rolePermissions, permissions } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { checkConnectionAccess } from '@/lib/rbac';
import { apiError, AppError } from '@/lib/errors';
import { auditLog } from '@/lib/audit';
import { decrypt } from '@/lib/encryption';
import { createDriver, evictDriverIfAuthError } from '@/lib/drivers';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

function bigintReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return Number(value);
  return value;
}

const MAX_ROWS = 2000;

const querySchema = z.object({
  sql: z.string().min(1),
  params: z.array(z.unknown()).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);

    const { id } = await params;
    const body = querySchema.parse(await req.json());

    const conn = await db.query.connections.findFirst({
      where: eq(connections.id, id),
    });
    if (!conn) throw new AppError('Connection not found', 404);

    const hasExecute = await db
      .select({ id: permissions.id })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(rolePermissions.roleId, user.roleId),
          eq(permissions.code, 'queries.execute')
        )
      )
      .limit(1);

    const hasReadonly = await db
      .select({ id: permissions.id })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(rolePermissions.roleId, user.roleId),
          eq(permissions.code, 'queries.readonly')
        )
      )
      .limit(1);

    if (hasExecute.length === 0 && hasReadonly.length === 0) {
      throw new AppError('Missing required permission: queries.execute', 403);
    }

    const access = await checkConnectionAccess(user.id, id, body.sql);
    if (!access.allowed) {
      throw new AppError('Access denied for this connection or query', 403);
    }

    const password = decrypt(conn.encryptedPassword);
    const driver = createDriver(id, conn.type, {
      host: conn.host,
      port: conn.port,
      database: conn.database,
      username: conn.username,
      password,
      ssl: conn.ssl,
    });

    const start = performance.now();
    let result: Awaited<ReturnType<typeof driver.query>>;
    try {
      result = await driver.query(body.sql, body.params);
    } catch (qErr) {
      evictDriverIfAuthError(id, qErr);
      throw qErr;
    }
    const duration = Math.round(performance.now() - start);

    await db.insert(queryLogs).values({
      connectionId: id,
      userId: user.id,
      query: body.sql,
      duration,
      executedAt: new Date().toISOString(),
    });

    const truncated = result.rows.length > MAX_ROWS;
    const responseBody = {
      rows: truncated ? result.rows.slice(0, MAX_ROWS) : result.rows,
      fields: result.fields,
      rowCount: result.rowCount,
      duration,
      truncated,
    };

    auditLog({
      ts: Date.now(),
      method: 'POST',
      url: req.nextUrl?.pathname ?? '',
      status: 200,
      reqHeaders: {
        authorization: req.headers.get('authorization')?.slice(0, 40),
        'content-type': req.headers.get('content-type') ?? undefined,
      },
      resBody: responseBody,
    });

    return new Response(JSON.stringify(responseBody, bigintReplacer), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    return apiError(err, req);
  }
}
