import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN!
});

export async function GET() {
  try {
    // returns a flat array like [member, score, member, score]
    const flat = await redis.zrevrange('leaderboard', 0, 9, { withScores: true }) as any[];
    const out: { username: string; score: number }[] = [];
    for (let i = 0; i < flat.length; i += 2) {
      out.push({ username: String(flat[i]), score: Number(flat[i + 1]) });
    }
    return NextResponse.json(out);
  } catch {
    return NextResponse.json([]);
  }
}
