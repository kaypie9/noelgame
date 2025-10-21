'use client';

import { useEffect, useRef, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

// ===== helpers =====
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

// ===== types =====
type LeaderRow = { username: string; score: number };

// ===== component =====
export default function Page() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // UI
  const [scoreText, setScoreText] = useState('0');
  const [hint, setHint] = useState('tap Play, then Space or click to flap');
  const [leader, setLeader] = useState<LeaderRow[]>([]);
  const [viewer, setViewer] = useState<{ username: string; fid?: number }>({ username: 'guest' });

  // Game state
  const state = useRef<'start' | 'playing' | 'over'>('start');
  const score = useRef(0);
  const frames = useRef(0);
  const safeFrames = useRef(0);
  const pipes = useRef<Pipe[]>([]);
  const nextSpawnAt = useRef(60); // schedule (frames)

  // Responsive canvas dims (update in resize())
  const W = useRef(640);
  const H = useRef(480);
  const GROUND_H = useRef(60);
  const ASPECT = 4 / 3; // width/height target

  // Pipe randomness (balanced)
  const GAP_RANGE: [number, number] = [190, 260];      // opening height
  const WIDTH_RANGE: [number, number] = [60, 80];      // pipe thickness
  const SPEED_BASE = 2.0;                               // avg px/frame
  const SPEED_JITTER: [number, number] = [-0.2, 0.2];  // tiny variance
  const SPAWN_BASE = 110;                               // frames between spawns
  const SPAWN_JITTER: [number, number] = [0, 25];      // mild randomness
  const CLUSTER_PROB = 0.15;                            // rare close buddy
  const CLUSTER_OFFSET_PX: [number, number] = [130, 180];
  const VERTICAL_DRIFT = 20;                            // small gap wander

  // Bird physics (tuned)
  const GRAVITY = 0.16;
  const JUMP_IMPULSE = -6.0;
  const MAX_UP = -9;
  const MAX_DOWN = 8;
  const FLAP_COOLDOWN = 10;

  // Bird (radius will scale on resize a bit)
  const bird = useRef({ x: 120, y: 480 * 0.4, v: 0, r: 20 });
  const flapCd = useRef(0);

  // Mini App context
useEffect(() => {
  sdk.actions.ready();

  // Title: only call if this SDK version supports it
  try {
    (sdk.actions as any)?.setTitle?.('Flappy Mini');
  } catch {}
  // always set the document title as a fallback
  document.title = 'Flappy Mini';

  (async () => {
    try {
      const inMini = await sdk.isInMiniApp();
      if (inMini) {
        const ctx = await sdk.context;
        const u = ctx?.user;
        if (u?.username) setViewer({ username: u.username, fid: u.fid });
      }
    } catch {}
  })();
}, []);


  // Canvas + loop + resize
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctxRef.current = ctx;

    function resize() {
      // fit canvas to wrapper width, keep aspect, cap to viewport height
      const wrap = wrapperRef.current || document.body;
      const maxW = Math.max(1, Math.floor(wrap.clientWidth));
      let w = Math.min(maxW, 900); // optional cap
      let h = Math.floor(w / ASPECT);

      const maxH = Math.floor(window.innerHeight);
      if (h > maxH) {
        h = maxH;
        w = Math.floor(h * ASPECT);
      }

      const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // update logical world sizes
      const prevW = W.current, prevH = H.current;
      W.current = w;
      H.current = h;
      GROUND_H.current = Math.max(48, Math.round(h * 0.125)); // ~12.5% of height

      // lightly scale bird position/radius to new space (best-effort)
      const sx = w / prevW, sy = h / prevH;
      bird.current.x *= sx;
      bird.current.y *= sy;
      bird.current.r = Math.max(12, Math.round(w * 0.03));

      // update every pipe’s world H/ground (x/width stay in pixels)
      for (const p of pipes.current) {
        p.H = H.current;
        p.ground = GROUND_H.current;
      }
    }

    resize();
    window.addEventListener('resize', resize);

    function drawBG() {
      const _W = W.current, _H = H.current, _G = GROUND_H.current;
      const g = ctx.createLinearGradient(0, 0, 0, _H);
      g.addColorStop(0, '#6ea0ff'); g.addColorStop(1, '#7b57c7');
      ctx.fillStyle = g; ctx.fillRect(0, 0, _W, _H);

      // ground
      ctx.fillStyle = '#45308b';
      ctx.fillRect(0, _H - _G, _W, _G);
      ctx.strokeStyle = '#2e1f63'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, _H - _G); ctx.lineTo(_W, _H - _G); ctx.stroke();
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
        const _H = H.current, _G = GROUND_H.current, _W = W.current;

        // physics
        b.v += GRAVITY;
        b.v *= 0.995;
        if (b.v > MAX_DOWN) b.v = MAX_DOWN;
        if (b.v < MAX_UP) b.v = MAX_UP;
        b.y += b.v;

        // spawn (interval + jitter)
        if (frames.current >= nextSpawnAt.current) {
          spawnPipe(_W);
          scheduleNextSpawn();
        }

        // pipes update, collide, score
        for (let i = pipes.current.length - 1; i >= 0; i--) {
          const p = pipes.current[i];
          p.update();
          p.draw(ctx);

          if (!p.scored && b.x > p.x + p.width) {
            p.scored = true;
            score.current++;
            setScoreText(String(score.current));
          }
          if (p.x + p.width < 0) {
            pipes.current.splice(i, 1);
            continue;
          }
          if (safeFrames.current <= 0 && p.collidesWith(b)) endGame();
        }

        // ceiling
        if (b.y - b.r <= 0 && safeFrames.current <= 0) endGame();

        // ground
        const groundY = _H - _G - b.r;
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
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // spawning helpers
  function spawnPipe(startX = W.current) {
    const _H = H.current, _G = GROUND_H.current;

    const speed = SPEED_BASE + randFloat(SPEED_JITTER[0], SPEED_JITTER[1]);
    const p = new Pipe(startX, _H, _G, {
      gap: randInt(GAP_RANGE[0], GAP_RANGE[1]),
      width: randInt(WIDTH_RANGE[0], WIDTH_RANGE[1]),
      speed
    });

    // gentle vertical drift vs last pipe
    const last = pipes.current.length ? pipes.current[pipes.current.length - 1] : null;
    if (last) {
      const drift = randInt(-VERTICAL_DRIFT, VERTICAL_DRIFT);
      const topMin = 40;
      const topMax = Math.max(topMin, _H - _G - p.gap - 40);
      p.top = Math.min(topMax, Math.max(topMin, p.top + drift));
    }
    pipes.current.push(p);

    // rare “close pair”
    if (Math.random() < CLUSTER_PROB) {
      const buddyX = startX + randInt(CLUSTER_OFFSET_PX[0], CLUSTER_OFFSET_PX[1]);
      const buddy = new Pipe(buddyX, _H, _G, {
        gap: randInt(GAP_RANGE[0], GAP_RANGE[1]),
        width: randInt(WIDTH_RANGE[0], WIDTH_RANGE[1]),
        speed
      });
      const topMin = 40;
      const topMax = Math.max(topMin, _H - _G - buddy.gap - 40);
      buddy.top = Math.min(topMax, Math.max(topMin, p.top + randInt(-10, 10)));
      pipes.current.push(buddy);
    }
  }

  function scheduleNextSpawn() {
    const jitter = randInt(SPAWN_JITTER[0], SPAWN_JITTER[1]);
    nextSpawnAt.current += SPAWN_BASE + jitter;
  }

  // API helpers (safe if routes not set)
  async function sendScore(username: string, s: number) {
    try {
      await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, score: s })
      });
    } catch {}
  }
  async function loadLeaderboard() {
    try {
      const r = await fetch('/api/leaderboard');
      if (!r.ok) return;
      const data = (await r.json()) as LeaderRow[];
      setLeader(data);
    } catch {}
  }

  // Controls
  function startGame() {
    state.current = 'playing';
    setHint(`fly, @${viewer.username}!`);
    pipes.current = [];
    score.current = 0;
    frames.current = 0;
    safeFrames.current = 90;        // grace
    flapCd.current = 0;
    setScoreText('0');
    bird.current.x = Math.round(W.current * 0.18);
    bird.current.y = H.current * 0.4;
    bird.current.v = 0;
    bird.current.r = Math.max(12, Math.round(W.current * 0.03));
    nextSpawnAt.current = frames.current + 60; // first pipe ~1s in
  }
  function restartGame() { startGame(); }
  function endGame() {
    if (state.current !== 'playing') return;
    state.current = 'over';
    setHint('game over. press Restart');
    void sendScore(viewer.username, score.current).then(loadLeaderboard);
  }

  useEffect(() => { void loadLeaderboard(); }, []);

  return (
    <div
      ref={wrapperRef}
      style={{
        width: '100%',
        height: '100dvh',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        padding: 0,
      }}
    >
      <div style={{ width: '100%', maxWidth: 900 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8 }}>
          <button type="button" onClick={startGame} style={btn}>Play</button>
          <button type="button" onClick={restartGame} style={{ ...btn, background: '#2a1f3b' }}>Restart</button>
          <div style={{ fontWeight: 700, marginLeft: 'auto' }}>{scoreText}</div>
        </div>

        <canvas ref={canvasRef} />

        {hint && <div style={{ color: '#b8a7d9', fontSize: 12, padding: '6px 8px' }}>{hint}</div>}

        {leader.length > 0 && (
          <div style={{ padding: '6px 8px' }}>
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

// ===== styles =====
const btn: React.CSSProperties = {
  background: '#8e44ad',
  color: '#fff',
  border: 'none',
  padding: '10px 14px',
  borderRadius: 12,
  fontWeight: 700,
  cursor: 'pointer'
};

// ===== Pipe class (moving) =====
class Pipe {
  x: number; width: number; gap: number; top: number; speed: number;
  H: number; ground: number; scored = false;
  constructor(startX: number, H: number, GROUND_H: number, opts?: {
    gap?: number; width?: number; speed?: number; top?: number;
  }) {
    this.x = startX;
    this.H = H;
    this.ground = GROUND_H;

    this.gap   = opts?.gap   ?? randInt(190, 260);
    this.width = opts?.width ?? randInt(60, 80);
    this.speed = opts?.speed ?? 2.0;

    const topMin = 40;
    const topMax = Math.max(topMin, H - GROUND_H - this.gap - 40);
    this.top = opts?.top ?? randInt(topMin, topMax);
  }
  update() {
    this.x -= this.speed;
  }
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
