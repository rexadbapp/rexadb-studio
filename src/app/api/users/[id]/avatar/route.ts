import { users } from '@/db/schema';
import { apiResponse, AppError } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';
import { requireTargetUser } from '@/lib/db-helpers';
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

export const PUT = withHandler(async ({ req, params: { id }, user: caller, db }) => {
  const target = await requireTargetUser(db, caller.id, id, 'users.manage');

  const contentType = (req.headers.get('content-type') || '').split(';')[0].trim();
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new AppError('Content-Type must be one of: image/jpeg, image/png, image/gif, image/webp, image/avif', 415);
  }

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
});

export const DELETE = withHandler(async ({ req, params: { id }, user: caller, db }) => {
  const target = await requireTargetUser(db, caller.id, id, 'users.manage');

  if (target.avatarUrl) {
    const filepath = path.join(AVATAR_DIR, path.basename(target.avatarUrl));
    if (existsSync(filepath)) {
      await unlink(filepath).catch(() => {});
    }
  }

  await db.update(users).set({ avatarUrl: null }).where(eq(users.id, id));

  return apiResponse({ data: { success: true } }, 200, req);
});
