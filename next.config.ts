import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  experimental: {
    serverActions: {
      allowedOrigins: ["moim.munsong.app:8443", "localhost:3000"],
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
