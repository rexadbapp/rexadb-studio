import type { NextConfig } from 'next';

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
};

export default config;
