import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    'preview-chat-5f5e5356-32d0-478d-845d-7944f5b7bda3.space.z.ai',
    'chat-5f5e5356-32d0-478d-845d-7944f5b7bda3.space.z.ai',
    '.space.z.ai',
  ],
};

export default nextConfig;
