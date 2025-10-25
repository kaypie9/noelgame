'use client';

import { useEffect, useRef, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import ConnectWallet from '@/components/ConnectWallet';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { base } from 'wagmi/chains';
import { parseEther, stringToHex, type Hex } from 'viem';

const ri = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const rf = (a: number, b: number) => Math.random() * (b - a) + a;
const COLORS = ['#FFD700', '#FF69B4', '#00FFFF', '#ADFF2F', '#FFA500'];

export default function Page() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [score, setScore] = useState(0);
  const [hint, setHint] = useState('Press Play or Space to start');
  const [countdown, setCountdown] = useState(0);
  const [viewer] = useState<{ username: string }>({ username: 'guest' });
  const [paying, setPaying] = useState(false);

  // new: track pending hash so we can wait for receipt
  const [pendingHash, setPendingHash] = useState<`0x${string}` | undefined>(undefined);

  const { isConnected, address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();

  // wait for on-chain confirmation
  const { isSuccess: mined } = useWaitForTransactionReceipt({
    hash: pendingHash,
    chainId: base.id,
    confirmations: 1,
    query: { enabled: !!pendingHash },
  });

  // click lock to avoid double-send
  const clickedRef = useRef(false);

  const state = useRef<'start' | 'countdown' | 'playing' | 'over'>('start');
  const objects = useRef<{ x: number; y: number; size: number; color: string; speed: number; type: 'star' | 'rock' }[]>([]);
  const player = useRef({ x: 200, y: 420, w: 70, h: 20 });
  const frames = useRef(0);

  const W = useRef(640);
  const H = useRef(480);

  const OBJECT_SPAWN_INTERVAL = 100;
  const BASE_SPEED = 0.4;
  const SPEED_INC = 0.01;

  // Make sure host splash clears ASAP
  useEffect(() => {
    (async () => {
      try {
        await sdk.actions.ready();
        try { (sdk.actions as any)?.setTitle?.('Catch the Stars — Music Edition'); } catch {}
      } catch {}
    })();
    document.title = 'Catch the Stars — Music Edition';
  }, []);

  // start game after receipt mined
  useEffect(() => {
    if (mined && pendingHash) {
      setHint('Payment confirmed  starting');
      setPendingHash(undefined);
      startCountdownThenPlay();
      setPaying(false);
      clickedRef.current = false;
    }
  }, [mined, pendingHash]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctxRef.current = ctx;

    const audio = new Audio(
      'https://cdn.pixabay.com/download/audio/2022/03/15/audio_74c715d9cf.mp3?filename=peaceful-ambient-11157.mp3'
    );
    audio.loop = true;
    audio.volume = 0.3;
    audioRef.current = audio;

    function resize() {
      const wrap = wrapperRef.current || document.body;
      const w = Math.max(1, wrap.clientWidth);
      const h = Math.floor(w / (9 / 16));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      W.current = w;
      H.current = h;
      player.current.y = H.current - 40;
    }

    resize();
    window.addEventListener('resize', resize);

    const drawBG = () => {
      const g = ctx.createLinearGradient(0, 0, 0, H.current);
      g.addColorStop(0, '#020018');
      g.addColorStop(1, '#150435');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W.current, H.current);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = COLORS[ri(0, COLORS.length - 1)];
        ctx.fillRect(ri(0, W.current), ri(0, H.current), 2, 2);
      }
    };

    const drawPlayer = () => {
      const p = player.current;
      ctx.fillStyle = '#9b59b6';
      ctx.fillRect(p.x, p.y, p.w, p.h);
    };

    const drawObjects = () => {
      for (const o of objects.current) {
        if (o.type === 'rock') {
          ctx.fillStyle = '#444';
          ctx.beginPath();
          ctx.arc(o.x, o.y, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#bbb';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.fillStyle = o.color;
          ctx.beginPath();
          ctx.arc(o.x, o.y, o.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const spawnObject = () => {
      const isStar = Math.random() < 0.8;
      const x = ri(10, W.current - 10);
      const size = rf(6, 12);
      const speed = BASE_SPEED + score * SPEED_INC;
      const color = isStar ? COLORS[ri(0, COLORS.length - 1)] : '#555';
      const type = isStar ? 'star' : 'rock';
      objects.current.push({ x, y: -10, size, color, speed, type });
    };

    function drawGameOver() {
      const ctx = ctxRef.current!;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W.current, H.current);
      ctx.fillStyle = '#FF4C4C';
      ctx.font = `bold ${Math.round(W.current * 0.08)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💥 GAME OVER 💥', W.current / 2, H.current / 2);
    }

    const movePlayer = (dir: 'left' | 'right') => {
      const p = player.current;
      const step = 15;
      if (dir === 'left') p.x = Math.max(0, p.x - step);
      else p.x = Math.min(W.current - p.w, p.x + step);
    };

    const onKey = (e: KeyboardEvent) => {
      if (state.current !== 'playing') return;
      if (e.code === 'ArrowLeft') movePlayer('left');
      if (e.code === 'ArrowRight') movePlayer('right');
    };

    const onMouseMove = (e: MouseEvent) => {
      if (state.current !== 'playing') return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      player.current.x = Math.max(0, Math.min(W.current - player.current.w, x - player.current.w / 2));
    };

    document.addEventListener('keydown', onKey);
    canvas.addEventListener('mousemove', onMouseMove);

    function step() {
      frames.current++;
      drawBG();

      if (state.current === 'playing') {
        if (frames.current % OBJECT_SPAWN_INTERVAL === 0) spawnObject();

        for (let i = objects.current.length - 1; i >= 0; i--) {
          const o = objects.current[i];
          o.y += o.speed;
          const p = player.current;

          if (o.y + o.size > p.y && o.x > p.x && o.x < p.x + p.w) {
            if (o.type === 'star') {
              setScore((s) => s + 1);
              objects.current.splice(i, 1);
            } else {
              state.current = 'over';
              setHint('💥 GAME OVER — You hit a rock!');
              drawGameOver();
              audio.pause();
              return;
            }
          } else if (o.y > H.current) {
            objects.current.splice(i, 1);
          }
        }
      }

      drawObjects();
      drawPlayer();

      if (state.current === 'countdown' && countdown > 0) {
        const ctx = ctxRef.current!;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W.current, H.current);
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(W.current * 0.2)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(countdown), W.current / 2, H.current / 2);
      }

      requestAnimationFrame(step);
    }

    step();

    return () => {
      window.removeEventListener('resize', resize);
      document.removeEventListener('keydown', onKey);
      canvas.removeEventListener('mousemove', onMouseMove);
    };
  }, [countdown]);

  function startCountdownThenPlay() {
    objects.current = [];
    setScore(0);
    state.current = 'countdown';
    setHint('Get Ready ✨');
    setCountdown(3);
    audioRef.current?.play().catch(() => {});

    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          state.current = 'playing';
          setHint(`Catch stars & avoid rocks, @${viewer.username}!`);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  // SIMPLE BASE MAINNET TX via Wagmi, with uniqueness + receipt wait + click lock
  async function startGame() {
    if (!isConnected || !address) {
      setHint('Connect your wallet first!');
      return;
    }
    if (paying || clickedRef.current) return; // lock
    clickedRef.current = true;
    setPaying(true);
    setHint('opening wallet…');

    try {
      await sdk.actions.ready().catch(() => {});
      const inside = await sdk.isInMiniApp().catch(() => false);
      if (!inside) {
        setHint('Open inside Warpcast/Base App');
        return;
      }

      // make tx unique every time: tiny wei bump + memo data
      const uniqueWeiBump = BigInt(Date.now() % 6); // 0..5 wei
      const memo = `play:${Date.now()}`;
      const hash = await sendTransactionAsync({
        to: '0xa0E19656321CaBaF46d434Fa71B263AbB6959F07',
        value: parseEther('0.00001') + uniqueWeiBump,
        data: stringToHex(memo) as Hex,
        chainId: base.id,
      });

      if (!hash) {
        setHint('Transaction cancelled or blocked');
        return;
      }

      // wait for confirmation before starting
      setHint('waiting for confirmation');
      setPendingHash(hash);
      // startCountdownThenPlay() is triggered by the mined effect
      return;
    } catch (err) {
      console.error(err);
      setHint('Transaction cancelled or blocked');
    } finally {
      // keep paying true until mined to block UI; reset is in mined effect
      if (!pendingHash) {
        setPaying(false);
        clickedRef.current = false;
      }
    }
  }

  return (
    <div
      ref={wrapperRef}
      style={{
        width: '100%',
        height: '100dvh',
        position: 'relative',
        background: '#000',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          zIndex: 0,
          position: 'relative',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          display: 'flex',
          gap: 8,
          zIndex: 10,
          alignItems: 'center',
        }}
      >
        <button onClick={startGame} style={btn} disabled={paying || !!pendingHash}>
          {pendingHash ? 'Confirming…' : paying ? 'Processing…' : 'Play'}
        </button>

        {/* Restart now also pays again — no free starts */}
        <button onClick={startGame} style={{ ...btn, background: '#2a1f3b' }} disabled={paying || !!pendingHash}>
          Restart
        </button>

        <ConnectWallet />
      </div>

      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          fontWeight: 800,
          color: '#fff',
          zIndex: 10,
        }}
      >
        {score}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 10,
          bottom: 10,
          color: '#b8a7d9',
          fontSize: 12,
          zIndex: 10,
        }}
      >
        {hint}
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
  cursor: 'pointer',
};
