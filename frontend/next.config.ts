import type { NextConfig } from "next"


const nextConfig: NextConfig = {
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
        source: "/basics/:path*",
        destination: "http://backend:9000/basics/:path*",
      },
    ]
  },
}

export default nextConfig