import type { NextConfig } from 'next';

const CORS_HEADERS = [
  { key: 'Access-Control-Allow-Origin', value: '*' },
  { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
  { key: 'Access-Control-Allow-Headers', value: 'Authorization,Content-Type' },
];

const config: NextConfig = {
  output: 'standalone',
  images: { unoptimized: true },
  async rewrites() {
    return [
      {
        source: '/api/studio-proxy/:path*',
        destination: '/api/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: CORS_HEADERS,
      },
      {
        source: '/api/studio-proxy/:path*',
        headers: CORS_HEADERS,
      },
    ];
  },
};

export default config;
