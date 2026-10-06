import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    'localhost:8088',
    '127.0.0.1:8088'
  ],
};

export default nextConfig;
