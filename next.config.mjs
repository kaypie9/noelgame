/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@coinbase/onchainkit', 'wagmi', 'viem'],
};
export default nextConfig;
