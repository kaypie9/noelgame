// app/api/leaderboard/route.ts
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

    // Use zrange + rev:true instead of zrevrange (works across versions)
    const flat = (await redis.zrange('leaderboard', {
      start: 0,
      stop: 9,
      rev: true,
      withScores: true,
    })) as (string | number)[];

    const out: { username: string; score: number }[] = [];
    for (let i = 0; i < flat.length; i += 2) {
      out.push({ username: String(flat[i]), score: Number(flat[i + 1]) });
    }

    return NextResponse.json(out);
  } catch (e) {
    console.error('leaderboard error', e);
    return NextResponse.json([]);
  }
}
