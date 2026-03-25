/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@solana/web3.js'],
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: [
    'preview-chat-5f5e5356-32d0-478d-845d-7944f5b7bda3.space.z.ai',
    '.space.z.ai',
  ],
};

module.exports = nextConfig;
