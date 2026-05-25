import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { savedQueries, connections } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'connections.read');

    const { id } = await params;
    const conn = await db.query.connections.findFirst({ where: eq(connections.id, id) });
    if (!conn) throw new AppError('Connection not found', 404);

    const list = await db.query.savedQueries.findMany({
      where: eq(savedQueries.connectionId, id),
      orderBy: (sq, { asc }) => [asc(sq.name)],
    });

    return apiResponse({ data: list }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  queryText: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const user = await authenticate(req);
    await requirePermission(user.id, 'queries.saved');

    const { id } = await params;
    const body = createSchema.parse(await req.json());

    const conn = await db.query.connections.findFirst({ where: eq(connections.id, id) });
    if (!conn) throw new AppError('Connection not found', 404);

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
  } catch (err) {
    return apiError(err, req);
  }
}
