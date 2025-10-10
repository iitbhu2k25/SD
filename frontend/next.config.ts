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
        destination: 'http://geoserver:8080/geoserver/:path*'
      },
      {
        source: '/api/:path*',
        destination: "http://fast_backend:7000/api/:path*"
      },
      {
        source: "/django/:path*",
        destination: "http://backend:9000/django/:path*",
      },
    ]
  },
}

export default nextConfig
