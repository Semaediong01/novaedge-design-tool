import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/products", destination: "/shop", permanent: true }];
  },
};

export default nextConfig;
