import { readFile, writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { join } from 'node:path';

const META_FILE = process.env.STUDIO_META_FILE ?? join(process.cwd(), 'data', 'studio.json');

function hostnameToName(raw: string): string {
  const cleaned = raw
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim();
  if (!cleaned) return 'Default Studio';
  const titled = cleaned
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return titled.endsWith(' Studio') ? titled : `${titled} Studio`;
}

async function loadFromFile(): Promise<string | null> {
  try {
    const raw = await readFile(META_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return typeof data.name === 'string' && data.name ? data.name : null;
  } catch {
    return null;
  }
}

async function saveToFile(name: string): Promise<void> {
  try {
    await writeFile(META_FILE, JSON.stringify({ name }, null, 2), 'utf-8');
  } catch (e) {
    console.error('[studio] failed to persist name:', e);
  }
}

let cached: string | null = null;

export async function getStudioName(): Promise<string> {
  if (cached) return cached;

  const envName = process.env.STUDIO_NAME;
  if (envName) {
    cached = envName;
    return cached;
  }

  const file = await loadFromFile();
  if (file) {
    cached = file;
    return cached;
  }

  const generated = hostnameToName(hostname());
  cached = generated;
  await saveToFile(generated);
  return cached;
}
