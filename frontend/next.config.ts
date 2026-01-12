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
      {
        source: '/api/:path*',
        destination: "http://localhost:7000/api/:path*"
      },
      {
        source: '/access_token/:path*',
        destination: "http://localhost:7000/access_token/:path*"
      },
      {
        source: "/django/:path*",
        destination: "http://backend:9000/django/:path*",
      },
      {
        source: "/fastm/:path*",
        destination: "http://fast_m:6500/:path*",
      },
    ]
  },
}

export default nextConfig
