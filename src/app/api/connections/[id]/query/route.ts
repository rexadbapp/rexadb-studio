import { checkConnectionAccess, hasPermission } from '@/lib/rbac';
import { AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { requireConnection } from '@/lib/db-helpers';
import { auditLog, bigintReplacer } from '@/lib/audit';
import { decrypt } from '@/lib/encryption';
import { createDriverFromConnection } from '@/lib/drivers';
import { executeAndLogQuery } from '@/lib/query-executor';
import { z } from 'zod';

const MAX_ROWS = 2000;

const querySchema = z.object({
  sql: z.string().min(1),
  params: z.array(z.unknown()).optional(),
});

export const POST = withHandler(async ({ req, params: { id }, user, db }) => {
  const body = querySchema.parse(await req.json());
  const conn = await requireConnection(db, id);

  const hasExecute = await hasPermission(user.id, 'queries.execute');
  const hasReadonly = await hasPermission(user.id, 'queries.readonly');

  if (!hasExecute && !hasReadonly) {
    throw new AppError('Missing required permission: queries.execute', 403);
  }

  const access = await checkConnectionAccess(user.id, id, body.sql);
  if (!access.allowed) {
    throw new AppError('Access denied for this connection or query', 403);
  }

  const driver = await createDriverFromConnection(id, conn, decrypt(conn.encryptedPassword));
  const { result, duration } = await executeAndLogQuery(db, id, user.id, driver, body.sql, body.params);

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
});
