import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const allowedOrigin = process.env.CORS_ORIGIN;
  const requestOrigin = request.headers.get('origin');

  if (allowedOrigin === '*') {
    response.headers.set('Access-Control-Allow-Origin', '*');
  } else if (allowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  } else if (requestOrigin) {
    response.headers.set('Access-Control-Allow-Origin', requestOrigin);
  } else {
    response.headers.set('Access-Control-Allow-Origin', '*');
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Authorization,Content-Type');
  response.headers.set('Vary', 'Origin');

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: response.headers });
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
