// lib/env.ts
// Non-throwing env access for both server & client.
// Do NOT import this file inside next.config.mjs.

export const env = {
  // Public (client)
  NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL ?? '',
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV ?? 'development',
  NEXT_PUBLIC_MINIKIT_PROJECT_ID: process.env.NEXT_PUBLIC_MINIKIT_PROJECT_ID ?? '',
  NEXT_PUBLIC_FARCASTER_HEADER: process.env.NEXT_PUBLIC_FARCASTER_HEADER ?? '',
  NEXT_PUBLIC_FARCASTER_PAYLOAD: process.env.NEXT_PUBLIC_FARCASTER_PAYLOAD ?? '',
  NEXT_PUBLIC_FARCASTER_SIGNATURE: process.env.NEXT_PUBLIC_FARCASTER_SIGNATURE ?? '',

  // Server (optional—APIs should guard usage)
  NEYNAR_API_KEY: process.env.NEYNAR_API_KEY ?? '',
  JWT_SECRET: process.env.JWT_SECRET ?? '',
  REDIS_URL: process.env.REDIS_URL ?? '',
  REDIS_TOKEN: process.env.REDIS_TOKEN ?? '',
};
