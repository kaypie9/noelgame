'use client';

import { useEffect, useRef, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

type LeaderRow = { username: string; score: number };

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ui
  const [scoreText, setScoreText] = useState('0');
  const [hint, setHint] = useState('tap Play, then Space or click to flap');
  const [leader, setLeader] = useState<LeaderRow[]>([]);
  const [viewer, setViewer] = useState<{ username: string; fid?: number }>({ username: 'guest' });

  // game refs
  const state = useRef<'start' | 'playing' | 'over'>('start');
  const score = useRef(0);
  const frames = useRef(0);
  const safeFrames = useRef(0);
  const pipes = useRef<Pipe[]>([]);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // constants
  const W = 640, H = 480, GROUND_H = 60;
  const GAP_MIN = 260, GAP_MAX = 320; // random pipe gap range
  const SPEED = 1.9;

  // tuned physics
  const GRAVITY = 0.16;
  const JUMP_IMPULSE = -6.0;
  const MAX_UP = -9;
  const MAX_DOWN = 8;
  const FLAP_COOLDOWN = 10;

  // bird
  const bird = useRef({ x: 120, y: H * 0.4, v: 0, r: 26 });
  const flapCd = useRef(0);

  // ---- Mini App: announce ready + load user context ----
  useEffect(() => {
    // hide splash
    sdk.actions.ready();

    // if we're in a Mini App, pull the viewer context (fid/username)
    (async () => {
      try {
        const inMini = await sdk.isInMiniApp();
        if (inMini) {
          const ctx = await sdk.context; // has user: { fid, username, ... }
          const u = ctx?.user;
          if (u?.username) setViewer({ username: u.username, fid: u.fid });
        }
      } catch (e) {
        // non-fatal; stick with "guest"
        console.warn('context read failed', e);
      }
    })();
  }, []);

  // ---- Canvas + game loop ----
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctxRef.current = ctx;

    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    function drawBG() {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#6ea0ff'); g.addColorStop(1, '#7b57c7');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // ground band + top line
      ctx.fillStyle = '#45308b';
      ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
      ctx.strokeStyle = '#2e1f63'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, H - GROUND_H); ctx.lineTo(W, H - GROUND_H); ctx.stroke();
    }

    function drawBird() {
      const b = bird.current;
      ctx.fillStyle = '#FFD700';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x + 8, b.y - 5, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(b.x + 10, b.y - 5, 3, 0, Math.PI * 2); ctx.fill();
    }

    function step() {
      frames.current++;
      if (safeFrames.current > 0) safeFrames.current--;
      if (flapCd.current > 0) flapCd.current--;

      drawBG();

      if (state.current === 'playing') {
        const b = bird.current;

        // physics
        b.v += GRAVITY;
        b.v *= 0.995;
        if (b.v > MAX_DOWN) b.v = MAX_DOWN;
        if (b.v < MAX_UP) b.v = MAX_UP;
        b.y += b.v;

        // spawn pipes after a short delay, then regularly
        if (frames.current > 60 && frames.current % 120 === 0) {
          pipes.current.push(new Pipe(W, H, GROUND_H, GAP_MIN, GAP_MAX, SPEED));
        }

        // pipes + scoring + collisions
        for (let i = pipes.current.length - 1; i >= 0; i--) {
          const p = pipes.current[i];
          p.update();
          p.draw(ctx);
          if (safeFrames.current <= 0 && p.collidesWith(b)) endGame();
          if (!p.scored && b.x > p.x + p.width) {
            p.scored = true;
            score.current++;
            setScoreText(String(score.current));
          }
          if (p.x + p.width < 0) pipes.current.splice(i, 1);
        }

        // ceiling
        if (b.y - b.r <= 0 && safeFrames.current <= 0) endGame();

        // ground
        const groundY = H - GROUND_H - b.r;
        if (b.y > groundY && safeFrames.current <= 0) endGame();
      } else {
        pipes.current.forEach(p => p.draw(ctx));
      }

      drawBird();

      requestAnimationFrame(step);
    }

    function flap() {
      if (state.current !== 'playing') return;
      if (flapCd.current > 0) return;
      bird.current.v = JUMP_IMPULSE;
      flapCd.current = FLAP_COOLDOWN;
    }

    function onClick() { flap(); }
    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); flap(); }
    }

    canvas.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    step();

    return () => {
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // ---- Simple API helpers (optional; no-op if routes/env not set) ----
  async function sendScore(username: string, s: number) {
    try {
      await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, score: s })
      });
    } catch {/* ignore in dev */}
  }
  async function loadLeaderboard() {
    try {
      const r = await fetch('/api/leaderboard');
      if (!r.ok) return;
      const data = (await r.json()) as LeaderRow[];
      setLeader(data);
    } catch {/* ignore in dev */}
  }

  // ---- Game control ----
  function startGame() {
    state.current = 'playing';
    setHint(`fly, @${viewer.username}!`);
    pipes.current = [];
    score.current = 0;
    frames.current = 0;
    safeFrames.current = 90;        // ~1.5s grace period
    flapCd.current = 0;
    setScoreText('0');
    bird.current.y = H * 0.4;
    bird.current.v = 0;
  }

  function restartGame() { startGame(); }

  function endGame() {
    if (state.current !== 'playing') return;
    state.current = 'over';
    setHint('game over. press Restart');
    // store + refresh board (if APIs exist)
    void sendScore(viewer.username, score.current).then(loadLeaderboard);
  }

  // first paint: try to load board (safe to ignore errors)
  useEffect(() => { void loadLeaderboard(); }, []);

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 640 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <button type="button" onClick={startGame} style={btn}>Play</button>
          <button type="button" onClick={restartGame} style={{ ...btn, background: '#2a1f3b' }}>Restart</button>
          <div style={{ fontWeight: 700, marginLeft: 'auto' }}>
            {scoreText}
          </div>
        </div>

        <canvas ref={canvasRef} />

        <div style={{ color: '#b8a7d9', fontSize: 12, marginTop: 8 }}>{hint}</div>

        {/* Leaderboard (renders only if API returns data) */}
        {leader.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h4 style={{ margin: '8px 0' }}>Leaderboard</h4>
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              {leader.map((row, i) => (
                <li key={row.username + i}>{i + 1}. {row.username} — {row.score}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  background: '#8e44ad',
  color: '#fff',
  border: 'none',
  padding: '10px 14px',
  borderRadius: 12,
  fontWeight: 700,
  cursor: 'pointer'
};

// pipe with randomized height and gap
class Pipe {
  x: number; width: number; gap: number; top: number; speed: number; H: number; ground: number; scored = false;
  constructor(W: number, H: number, GROUND_H: number, GAP_MIN: number, GAP_MAX: number, SPEED: number) {
    this.x = W;
    this.width = 70;
    this.H = H;
    this.ground = GROUND_H;
    this.speed = SPEED;

    this.gap = randInt(GAP_MIN, GAP_MAX);

    const topMin = 40;
    const topMax = H - GROUND_H - this.gap - 40;
    this.top = randInt(topMin, topMax);
  }
  update() { this.x -= this.speed; }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#00C853'; ctx.strokeStyle = '#006E2E'; ctx.lineWidth = 4;

    // top
    ctx.fillRect(this.x, 0, this.width, this.top);
    ctx.strokeRect(this.x, 0, this.width, this.top);

    // bottom
    const bottomY = this.top + this.gap;
    const bottomH = this.H - this.ground - bottomY;
    ctx.fillRect(this.x, bottomY, this.width, bottomH);
    ctx.strokeRect(this.x, bottomY, this.width, bottomH);
  }
  collidesWith(b: { x: number; y: number; r: number }) {
    if (b.x + b.r > this.x && b.x - b.r < this.x + this.width) {
      const gapTop = this.top;
      const gapBot = this.top + this.gap;
      if (b.y - b.r < gapTop || b.y + b.r > gapBot) return true;
    }
    return false;
  }
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
