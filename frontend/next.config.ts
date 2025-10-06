import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/geoserver/api/:path*',
        destination: 'http://localhost:9090/geoserver/:path*'
      },
      {
        source: '/api/:path*',
        destination: "http://localhost:7000/api/:path*"
      },
      {
        source: "/django/:path*",
        destination: "http://localhost:9000/django/:path*",
      },
    ]
  },
}

export default nextConfig
