import { NextResponse } from 'next/server';

export async function GET() {
  try {
    if (!process.env.REDIS_URL || !process.env.REDIS_TOKEN) {
      return NextResponse.json([]);
    }

    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({
      url: process.env.REDIS_URL,
      token: process.env.REDIS_TOKEN,
    });

    const flat = (await redis.zrevrange('leaderboard', {
      start: 0,
      stop: 9,
      withScores: true,
    })) as [string, number][];

    const out = flat.map(([username, score]) => ({
      username,
      score: Number(score),
    }));

    return NextResponse.json(out);
  } catch (e) {
    console.error('leaderboard error', e);
    return NextResponse.json([]);
  }
}
