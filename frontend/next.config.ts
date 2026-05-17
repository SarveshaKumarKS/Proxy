import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mapbox-gl ships ESM that webpack needs to transpile
  transpilePackages: ["mapbox-gl"],
  // Allow cross-origin requests from the backend during development
  experimental: {},
};

export default nextConfig;
