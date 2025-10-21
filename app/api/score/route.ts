import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN!
});

// Keep only best score per username
export async function POST(req: NextRequest) {
  try {
    // 1) parse & validate
    const body = await req.json().catch(() => ({}));
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const incoming = typeof body?.score === 'number' ? body.score : Number(body?.score);

    if (!username || !Number.isFinite(incoming)) {
      return NextResponse.json({ error: 'bad payload' }, { status: 400 });
    }

    const score = Math.max(0, Math.floor(incoming)); // clamp to non-negative int

    // 2) read previous best (might be null)
    const prev = (await redis.zscore('leaderboard', username)) as number | null;

    // 3) update only if improved
    if (prev === null || score > prev) {
      await redis.zadd('leaderboard', { member: username, score });
    }

    return NextResponse.json({ ok: true, previous: prev, saved: prev === null || score > prev ? score : prev });
  } catch (err) {
    console.error('score route error:', err);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
}
