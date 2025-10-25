'use client';

import { ReactNode, useMemo } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';

export default function Providers({ children }: { children: ReactNode }) {
  const queryClient = useMemo(() => new QueryClient(), []);

  const wagmiConfig = useMemo(
    () =>
      createConfig({
        chains: [base],
        transports: { [base.id]: http() }, // replace with your own RPC if you want
        connectors: [farcasterMiniApp()],
        ssr: false, // IMPORTANT for Next app router
      }),
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
    </QueryClientProvider>
  );
}
