import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  serverExternalPackages: ['@google/generative-ai'], 
  logging: { fetches: { fullUrl: true } }
};

export default nextConfig;
