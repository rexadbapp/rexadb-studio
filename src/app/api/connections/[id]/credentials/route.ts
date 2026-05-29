import { requirePermission } from '@/lib/rbac';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { requireConnection } from '@/lib/db-helpers';
import { decrypt } from '@/lib/encryption';

export const GET = withHandler(async ({ req, params: { id }, user, db }) => {
  await requirePermission(user.id, 'connections.manage_access');
  const conn = await requireConnection(db, id);

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
});
