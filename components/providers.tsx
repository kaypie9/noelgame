'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { walletConnect } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Load MiniKit only in the browser to avoid SSR/bundle issues
const MiniKitProvider = dynamic(
  () => import('@coinbase/onchainkit/minikit').then(m => m.MiniKitProvider),
  { ssr: false }
);

const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || '';          // WalletConnect Cloud project
const minikitProjectId = process.env.NEXT_PUBLIC_MINIKIT_PROJECT_ID || ''; // MiniKit project id (if you use it)

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(() => new QueryClient(), []);
  const wagmiConfig = useMemo(
    () =>
      createConfig({
        chains: [base],
        connectors: [
          walletConnect({
            projectId: wcProjectId,
            showQrModal: true,     // opens WC modal if no injected wallet
          }),
        ],
        transports: {
          [base.id]: http(),       // public RPC; replace with your own if needed
        },
        ssr: false,                // IMPORTANT: avoid SSR wallet code
      }),
    [wcProjectId]
  );

  // If you don't have ids yet, still render children; providers won’t initialize
  const wrapWithMiniKit = (node: React.ReactNode) =>
    minikitProjectId ? (
      <MiniKitProvider projectId={minikitProjectId}>{node}</MiniKitProvider>
    ) : (
      <>{node}</>
    );

  const app = (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
    </QueryClientProvider>
  );

  return wrapWithMiniKit(app);
}
