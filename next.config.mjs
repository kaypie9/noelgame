/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@coinbase/onchainkit',
    'wagmi',
    'viem',
    '@walletconnect/modal',
  ],
};
export default nextConfig;
