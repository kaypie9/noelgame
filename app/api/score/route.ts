import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { username, score } = await req.json();

    // If Redis creds are missing, just succeed (no-op) so build & runtime don't break
    if (!process.env.REDIS_URL || !process.env.REDIS_TOKEN) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({ url: process.env.REDIS_URL, token: process.env.REDIS_TOKEN });

    const name = typeof username === 'string' ? username.trim() : '';
    const incoming = typeof score === 'number' ? score : Number(score);
    if (!name || !Number.isFinite(incoming)) {
      return NextResponse.json({ error: 'bad payload' }, { status: 400 });
    }
    const s = Math.max(0, Math.floor(incoming));

    const prev = (await redis.zscore('leaderboard', name)) as number | null;
    if (prev === null || s > prev) {
      await redis.zadd('leaderboard', { member: name, score: s });
    }
    return NextResponse.json({ ok: true, previous: prev, saved: prev === null || s > prev ? s : prev });
  } catch (e) {
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
}
