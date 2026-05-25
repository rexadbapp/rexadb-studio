import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const AVATAR_DIR = path.resolve('data/avatars');

const mimeMap: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  const safe = path.basename(filename);
  const filepath = path.join(AVATAR_DIR, safe);

  if (!existsSync(filepath)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const ext = path.extname(safe).toLowerCase();
  const contentType = mimeMap[ext] || 'application/octet-stream';

  const buffer = await readFile(filepath);
  return new NextResponse(buffer, {
    status: 200,
    headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
