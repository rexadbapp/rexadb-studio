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
        conn.type === 'postgres' || conn.type === 'cockroachdb' || conn.type === 'yugabyte'
          ? `postgresql://${conn.username}:${encodeURIComponent(password)}@${conn.host}:${conn.port}/${conn.database}`
          : conn.type === 'mysql'
            ? `mysql://${conn.username}:${encodeURIComponent(password)}@${conn.host}:${conn.port}/${conn.database}`
            : conn.type === 'mariadb'
              ? `mariadb://${conn.username}:${encodeURIComponent(password)}@${conn.host}:${conn.port}/${conn.database}`
              : conn.type === 'redshift'
                ? `redshift://${conn.username}:${encodeURIComponent(password)}@${conn.host}:${conn.port}/${conn.database}`
                : `sqlserver://${conn.username}:${encodeURIComponent(password)}@${conn.host}:${conn.port};database=${conn.database}`,
    },
  }, 200, req);
});
