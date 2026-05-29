import { apiResponse } from '@/lib/errors';
import { withHandler } from '@/lib/api-handler';

export const GET = withHandler(async ({ req, user }) => {
  return apiResponse({ user }, 200, req);
});
