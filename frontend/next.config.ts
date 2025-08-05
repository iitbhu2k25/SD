import type { NextConfig } from "next"


const nextConfig: NextConfig = {
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
        source: "/basics/:path*",
        destination: "http://backend:9000/basics/:path*",
      },
    ]
  },
}

export default nextConfig