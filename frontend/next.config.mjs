const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://backend:8000/api/v1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${backendUrl}/:path*`
      }
    ];
  }
};

export default nextConfig;
