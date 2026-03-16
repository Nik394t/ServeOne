const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://backend:8000/api/v1';
const isStaticExport = process.env.NEXT_OUTPUT_MODE === 'export';
const pagesBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim();
const normalizedBasePath =
  pagesBasePath && pagesBasePath !== '/' ? `/${pagesBasePath.replace(/^\/+|\/+$/g, '')}` : '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: isStaticExport ? 'export' : 'standalone',
  ...(normalizedBasePath ? { basePath: normalizedBasePath } : {}),
  trailingSlash: isStaticExport,
  images: {
    unoptimized: isStaticExport
  },
  ...(!isStaticExport
    ? {
        async rewrites() {
          return [
            {
              source: '/api/backend/:path*',
              destination: `${backendUrl}/:path*`
            }
          ];
        }
      }
    : {})
};

export default nextConfig;
