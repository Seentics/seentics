/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
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
