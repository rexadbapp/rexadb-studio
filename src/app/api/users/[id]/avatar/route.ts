import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { authenticate } from '@/lib/auth';
import { requirePermission } from '@/lib/rbac';
import { apiError, apiResponse, AppError } from '@/lib/errors';
import { eq } from 'drizzle-orm';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const AVATAR_DIR = path.resolve('data/avatars');
const MAX_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];

async function ensureDir() {
  if (!existsSync(AVATAR_DIR)) {
    await mkdir(AVATAR_DIR, { recursive: true });
  }
}

const extMap: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
};

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await authenticate(req);
    const canManage = await requirePermission(caller.id, 'users.manage').then(() => true).catch(() => false);
    const { id } = await params;

    if (caller.id !== id && !canManage) {
      throw new AppError('Forbidden', 403);
    }

    const contentType = (req.headers.get('content-type') || '').split(';')[0].trim();
    if (!ALLOWED_TYPES.includes(contentType)) {
      throw new AppError('Content-Type must be one of: image/jpeg, image/png, image/gif, image/webp, image/avif', 415);
    }

    const db = getDb();
    const target = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!target) throw new AppError('User not found', 404);

    const buffer = Buffer.from(await req.arrayBuffer());
    if (buffer.length > MAX_SIZE) {
      throw new AppError('File too large. Maximum size is 50MB', 413);
    }

    await ensureDir();

    const ext = extMap[contentType] || '.bin';
    const filename = `${id}-${crypto.randomUUID()}${ext}`;
    const filepath = path.join(AVATAR_DIR, filename);

    await writeFile(filepath, buffer);

    if (target.avatarUrl) {
      const oldPath = path.join(AVATAR_DIR, path.basename(target.avatarUrl));
      if (existsSync(oldPath)) {
        await unlink(oldPath).catch(() => {});
      }
    }

    await db.update(users).set({ avatarUrl: filename }).where(eq(users.id, id));

    return apiResponse({ data: { avatarUrl: filename } }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await authenticate(req);
    const canManage = await requirePermission(caller.id, 'users.manage').then(() => true).catch(() => false);
    const { id } = await params;

    if (caller.id !== id && !canManage) {
      throw new AppError('Forbidden', 403);
    }

    const db = getDb();
    const target = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!target) throw new AppError('User not found', 404);

    if (target.avatarUrl) {
      const filepath = path.join(AVATAR_DIR, path.basename(target.avatarUrl));
      if (existsSync(filepath)) {
        await unlink(filepath).catch(() => {});
      }
    }

    await db.update(users).set({ avatarUrl: null }).where(eq(users.id, id));

    return apiResponse({ data: { success: true } }, 200, req);
  } catch (err) {
    return apiError(err, req);
  }
}
