import { getStudioName } from '@/lib/studio-name';

export const runtime = 'nodejs';

export async function GET() {
  const name = await getStudioName();
  return Response.json({ name });
}
