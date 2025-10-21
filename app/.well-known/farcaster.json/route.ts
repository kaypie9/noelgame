import { NextResponse } from 'next/server';

// make sure this route always runs on the server at request time
export const dynamic = 'force-dynamic';

const ROOT = process.env.NEXT_PUBLIC_URL || 'https://flippybirdgame.vercel.app';

// your known-good association values (fallbacks)
const FALLBACK = {
  header:
    'eyJmaWQiOjUzNjY0NiwidHlwZSI6ImF1dGgiLCJrZXkiOiIweGY0RjYxQkMyNmQyRmVkMDJCRUU4MkU4OEVGQTREOWFjMDAyYzMxODUifQ',
  payload: 'eyJkb21haW4iOiJmbGlwcHliaXJkZ2FtZS52ZXJjZWwuYXBwIn0',
  signature:
    'T0UFQAn0TivI7Duu5GMy4ZtMF0VfpxHztoEI0SF1ypBGzDu1STFwbpuh/5PDUwSQkV9eUwHYSJ1jdLPah99lChs=',
};

export async function GET() {
  const header = process.env.NEXT_PUBLIC_FARCASTER_HEADER || FALLBACK.header;
  const payload = process.env.NEXT_PUBLIC_FARCASTER_PAYLOAD || FALLBACK.payload;
  const signature =
    process.env.NEXT_PUBLIC_FARCASTER_SIGNATURE || FALLBACK.signature;

  return NextResponse.json({
    accountAssociation: { header, payload, signature },
    miniapp: {
      version: '1',
      name: 'Flappy Mini',
      subtitle: 'tap to fly',
      description: 'flappy style mini app',
      screenshotUrls: [`${ROOT}/screenshot-portrait.png`],
      iconUrl: `${ROOT}/icon.png`,
      splashImageUrl: `${ROOT}/splash.png`,
      splashBackgroundColor: '#000000',
      homeUrl: ROOT,
      webhookUrl: `${ROOT}/api/webhook`,
      primaryCategory: 'games',
      tags: ['game', 'arcade'],
      heroImageUrl: `${ROOT}/splash.png`,
      tagline: 'dodge the pipes',
      ogTitle: 'Flappy Mini',
      ogDescription: 'tap to play',
      ogImageUrl: `${ROOT}/splash.png`,
    },
  });
}
