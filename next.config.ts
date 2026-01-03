import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // TODO: Fix type errors and remove this
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
