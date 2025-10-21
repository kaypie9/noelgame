const ROOT = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

export const minikitConfig = {
  accountAssociation: {
    header: process.env.NEXT_PUBLIC_FARCASTER_HEADER || '',
    payload: process.env.NEXT_PUBLIC_FARCASTER_PAYLOAD || '',
    signature: process.env.NEXT_PUBLIC_FARCASTER_SIGNATURE || ''
  },
  miniapp: {
    version: '1',
    name: 'Farcaster Bird',
    subtitle: 'tap to fly',
    description: 'flappy style mini app',
    screenshotUrls: [`${ROOT}/screenshot-portrait.png`],
    iconUrl: `${ROOT}/icon.png`,
    splashImageUrl: `${ROOT}/splash.png`,
    splashBackgroundColor: '#000000',
    homeUrl: ROOT,
    webhookUrl: `${ROOT}/api/webhook`,
    primaryCategory: 'game',
    tags: ['game', 'arcade'],
    heroImageUrl: `${ROOT}/splash.png`,
    tagline: 'dodge the pipes',
    ogTitle: 'Farcaster Bird',
    ogDescription: 'tap to play',
    ogImageUrl: `${ROOT}/splash.png`
  }
} as const;
