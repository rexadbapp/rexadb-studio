import { savedQueries } from '@/db/schema';
import { requirePermission } from '@/lib/rbac';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { requireConnection } from '@/lib/db-helpers';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export const GET = withHandler(async ({ req, params: { id }, user, db }) => {
  await requirePermission(user.id, 'connections.read');
  await requireConnection(db, id);
  const list = await db.query.savedQueries.findMany({
    where: eq(savedQueries.connectionId, id),
    orderBy: (sq, { asc }) => [asc(sq.name)],
  });
  return apiResponse({ data: list }, 200, req);
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  queryText: z.string().min(1),
});

export const POST = withHandler(async ({ req, params: { id }, user, db }) => {
  await requirePermission(user.id, 'queries.saved');
  const body = createSchema.parse(await req.json());
  await requireConnection(db, id);

  const [sq] = await db
    .insert(savedQueries)
    .values({
      connectionId: id,
      name: body.name,
      queryText: body.queryText,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    })
    .returning();

  return apiResponse({ data: sq }, 201, req);
});
