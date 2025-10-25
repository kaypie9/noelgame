'use client';

import { useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

export default function MiniAppBootstrap() {
  useEffect(() => {
    (async () => {
      try {
        await sdk.actions.ready();
        // Optional: set a nice title in the host chrome
        try { (sdk.actions as any)?.setTitle?.('Catch the Stars — Music Edition'); } catch {}
      } catch (e) {
        console.warn('miniapp ready() failed:', e);
      }
    })();
  }, []);

  return null;
}
