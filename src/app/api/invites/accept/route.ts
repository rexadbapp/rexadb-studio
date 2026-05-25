import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { invites, users } from '@/db/schema';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { eq } from 'drizzle-orm';
import { generateStudioToken } from '@/lib/auth';
import crypto from 'node:crypto';
import { bcrypt } from '@/lib/bcrypt';
import { z } from 'zod';

const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    // Note: The accept endpoint does NOT require authentication via studio token
    // It is called by the main app on behalf of the user who has the invite token
    // We verify the invite token itself, not a studio session token.
    const db = getDb();
    const { token, name, email } = acceptSchema.parse(await req.json());

    // Find invite by token hash
    const pendingInvites = await db.query.invites.findMany({
      where: eq(invites.status, 'PENDING'),
    });

    let matchedInvite = null;
    for (const pending of pendingInvites) {
      const isValid = await bcrypt.compare(token, pending.tokenHash);
      if (isValid) {
        matchedInvite = pending;
        break;
      }
    }

    if (!matchedInvite) {
      throw new AppError('Invalid or expired token', 400);
    }

    // Optional: verify email matches (or allow user to provide different name?)
    // For security, we should verify that the email matches the invite email
    if (matchedInvite.email.toLowerCase() !== email.toLowerCase()) {
      throw new AppError('Email does not match invitation', 400);
    }

    // Mark invite as accepted
    const now = new Date().toISOString();
    await db
      .update(invites)
      .set({
        status: 'ACCEPTED',
        acceptedAt: now,
      })
      .where(eq(invites.id, matchedInvite.id));

    // Check if user already exists by email
    let existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    let userId: string;
    if (existingUser) {
      // If user exists, update their name and role if needed (or keep existing?)
      // For simplicity, we'll update name and keep existing role
      await db
        .update(users)
        .set({
          name,
          // Optionally update role if invite specifies a role
          // roleId: matchedInvite.roleId ?? existingUser.roleId,
        })
        .where(eq(users.id, existingUser.id));
      userId = existingUser.id;
    } else {
      // Create new user
      // Determine role: if invite has a roleId, use it; otherwise default to viewer
      const roleId = matchedInvite.roleId;
      userId = crypto.randomUUID(); // Generate UUID for user ID

      await db
        .insert(users)
        .values({
          id: userId,
          email,
          name,
          roleId,
          isActive: true,
          createdAt: now,
        });
    }

    // Generate studio session token for the user
    const studioToken = generateStudioToken(userId);

    return apiResponse({
      data: {
        userId,
        studioToken,
        // Optionally return user info
      },
    }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}