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
        source: '/geoserver/:path*',
        destination: 'http://localhost:9090/geoserver/:path*'
      },
      {
        source: '/api/:path*',
        destination: "http://localhost:7000/api/:path*"
      },
      {
        source: "/django/:path*",
        destination: "http://backend:9000/django/:path*",
      },
      {
        source: "/fastapi/:path*",
        destination: "http://localhost:7100/:path*",
      },
      {
        source: "/token/:path*",
        destination: "http://localhost:7000/access_token/:path*",
      },
    ]
  },
}

export default nextConfig