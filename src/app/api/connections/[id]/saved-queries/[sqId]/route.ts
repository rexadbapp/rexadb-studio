import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { savedQueries } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  queryText: z.string().min(1).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sqId: string }> }
) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'queries.saved');

    const { id, sqId } = await params;
    const body = updateSchema.parse(await req.json());

    const sq = await db.query.savedQueries.findFirst({
      where: and(
        eq(savedQueries.id, Number(sqId)),
        eq(savedQueries.connectionId, id)
      ),
    });
    if (!sq) throw new AppError('Saved query not found', 404);

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.queryText !== undefined) updates.queryText = body.queryText;

    if (Object.keys(updates).length > 0) {
      await db
        .update(savedQueries)
        .set(updates)
        .where(eq(savedQueries.id, Number(sqId)));
    }

    const updated = await db.query.savedQueries.findFirst({
      where: eq(savedQueries.id, Number(sqId)),
    });

    return apiResponse({ data: updated }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sqId: string }> }
) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'queries.saved');

    const { id, sqId } = await params;

    const sq = await db.query.savedQueries.findFirst({
      where: and(
        eq(savedQueries.id, Number(sqId)),
        eq(savedQueries.connectionId, id)
      ),
    });
    if (!sq) throw new AppError('Saved query not found', 404);

    await db.delete(savedQueries).where(eq(savedQueries.id, Number(sqId)));
    return apiResponse({ data: { success: true } }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
