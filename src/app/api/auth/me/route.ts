import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { authenticate } from '@/lib/auth';
import { apiError, apiResponse } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const user = await authenticate(req);

    const db = getDb();
    const profile = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, user.id),
      with: {
        role: {
          columns: { id: true, name: true, description: true },
          with: {
            rolePermissions: {
              with: { permission: { columns: { code: true, name: true } } },
            },
          },
        },
      },
    });

    const permissions = profile?.role?.rolePermissions?.map((rp) => rp.permission) ?? [];

    return apiResponse({
      data: {
        id: profile?.id,
        email: profile?.email,
        name: profile?.name,
        avatarUrl: profile?.avatarUrl?.replace(/^\/api\/avatars\//, '') ?? null,
        role: profile?.role
          ? { id: profile.role.id, name: profile.role.name, description: profile.role.description }
          : null,
        permissions,
      },
    }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
