import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { invites, users } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import { bcrypt } from '@/lib/bcrypt';
import { z } from 'zod';

const inviteCreateSchema = z.object({
  email: z.string().email(),
  roleId: z.number().int().positive().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await authenticate(req);
    await requirePermission(user.id, 'invites.view');

    const db = getDb();
    const allInvites = await db.query.invites.findMany({
      with: {
        createdByUser: {
          columns: { id: true, email: true, name: true, avatarUrl: true },
          with: {
            role: { columns: { id: true, name: true } },
          },
        },
      },
      orderBy: (i, { desc }) => [desc(i.createdAt)],
    });

    // Do not return token hashes
    const safeInvites = allInvites.map(invite => ({
      id: invite.id,
      email: invite.email,
      status: invite.status,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      acceptedAt: invite.acceptedAt,
      createdBy: invite.createdByUser,
    }));

    return apiResponse({ data: safeInvites }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticate(req);
    await requirePermission(user.id, 'invites.create');

    const db = getDb();
    const body = await req.json();
    const result = inviteCreateSchema.safeParse(body);
    if (!result.success) {
      throw new AppError('Invalid request body', 400);
    }
    const { email, roleId } = result.data;

    // Generate a secure random token (32 bytes -> 64 hex chars)
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const [invite] = await db
      .insert(invites)
      .values({
        tokenHash,
        email,
        roleId: roleId ?? 1, // Default to viewer role if not specified
        status: 'PENDING',
        expiresAt,
        createdBy: user.id,
        createdAt: now,
      })
      .returning();

    // Return the plain token ONLY ONCE
    return apiResponse({
      data: {
        id: invite.id,
        email: invite.email,
        token, // <-- only time the plain token is shown
        expiresAt,
      },
    }, 201, req);
  } catch (err) {
    return apiError(err, req);
  }
}