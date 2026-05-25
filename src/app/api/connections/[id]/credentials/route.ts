import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { connections } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { decrypt } from '@/lib/encryption';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'connections.manage_access');

    const { id } = await params;
    const conn = await db.query.connections.findFirst({ where: eq(connections.id, id) });
    if (!conn) throw new AppError('Connection not found', 404);

    const password = decrypt(conn.encryptedPassword);

    return apiResponse({
      data: {
        host: conn.host,
        port: conn.port,
        database: conn.database,
        username: conn.username,
        password,
        connectionString:
          conn.type === 'postgres'
            ? `postgresql://${conn.username}:${encodeURIComponent(password)}@${conn.host}:${conn.port}/${conn.database}`
            : `mysql://${conn.username}:${encodeURIComponent(password)}@${conn.host}:${conn.port}/${conn.database}`,
      },
    }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
