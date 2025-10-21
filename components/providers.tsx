'use client';

import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base } from 'wagmi/chains';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <OnchainKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY || ''} // required
      chain={base}
      miniKit={{ enabled: true }} // enable Mini App integration
      // optional branding:
      // config={{
      //   appearance: {
      //     mode: 'auto',
      //     theme: 'default',
      //     name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME,
      //     logo: process.env.NEXT_PUBLIC_ICON_URL,
      //   },
      // }}
    >
      {children}
    </OnchainKitProvider>
  );
}
