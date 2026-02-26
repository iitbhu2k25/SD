import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [

      {
        protocol: 'https',
        hostname: 'images.pexels.com',
        pathname: '/**',
      },

    ],
  },
  async rewrites() {
    return [
       {
        source: '/geoserver/api/:path*',
        destination: 'http://localhost:9090/geoserver/:path*'
      },
    ]
  },
}

export default nextConfig
