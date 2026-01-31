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
        hostname:'flagcdn.com'
      }
    ],
  },
  // CORS headers removed - API gateway handles CORS for API requests
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.API_GATEWAY_URL || 'http://localhost:3002'}/api/v1/:path*`,
        // Ensure this is a pure proxy without header manipulation
      },
    ];
  },
  // Explicitly disable any automatic header manipulation
  async headers() {
    return [];
  },
};

module.exports = nextConfig;
