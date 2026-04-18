/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // esbuild uses native platform binaries — tell Next.js not to bundle it,
  // just require() it at runtime from node_modules.
  serverExternalPackages: ['esbuild'],
  // Allow large tracker payloads (replay FullSnapshot + session batches often exceed 10MB)
  middlewareClientMaxBodySize: '128mb',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.google.com',
        port: '',
        pathname: '/s2/favicons/**',
      }
    ],
  },
  // CORS headers removed - API gateway handles CORS for API requests
  async rewrites() {
    return [
      {
        source: '/auth/google/callback',
        destination: '/auth/google/callback',
      },
      {
        source: '/api/v1/:path*',
        destination: `${process.env.API_GATEWAY_URL || 'http://localhost:8080'}/api/v1/:path*`,
      },
    ];
  },
  // Explicitly disable any automatic header manipulation
  async headers() {
    return [];
  },
};

module.exports = nextConfig;
