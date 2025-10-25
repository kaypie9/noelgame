'use client';

import { useEffect, useRef, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import ConnectWallet from '@/components/ConnectWallet';
import {
  useAccount,
  useSendTransaction,
  useWaitForTransactionReceipt,
  useChainId as useWagmiChainId,
  useSwitchChain,
} from 'wagmi';
import { Hex, parseEther } from 'viem';

const CHAIN_ID = 8453; // Base mainnet

const ri = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const rf = (a: number, b: number) => Math.random() * (b - a) + a;
type Obj = { x: number; y: number; size: number; color: string; speed: number; type: 'star' | 'rock' };
const COLORS = ['#FFD700', '#FF69B4', '#00FFFF', '#ADFF2F', '#FFA500'];

/** Price & treasury */
const PRICE_WEI = parseEther('0.00001'); // bigint > 0
const TREASURY: `0x${string}` = '0xa0E19656321CaBaF46d434Fa71B263AbB6959F07';

export default function Page() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [score, setScore] = useState(0);
  const [hint, setHint] = useState('Press Play or Space to start');
  const [countdown, setCountdown] = useState(0);
  const [paying, setPaying] = useState(false);
  const [pendingHash, setPendingHash] = useState<`0x${string}` | undefined>(undefined);

  const { isConnected, address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const currentChainId = useWagmiChainId();

  const { isSuccess: mined, isLoading: waitingReceipt } = useWaitForTransactionReceipt({
    hash: pendingHash,
    chainId: CHAIN_ID,
    confirmations: 1,
    query: { enabled: !!pendingHash },
  });

  const state = useRef<'start' | 'countdown' | 'playing' | 'over'>('start');
  const objects = useRef<Obj[]>([]);
  const player = useRef({ x: 200, y: 420, w: 70, h: 20 });
  const frames = useRef(0);
  const W = useRef(640);
  const H = useRef(480);
  const OBJECT_SPAWN_INTERVAL = 100;
  const BASE_SPEED = 0.4;
  const SPEED_INC = 0.01;

  // clear splash early
  useEffect(() => {
    (async () => {
      try {
        await sdk.actions.ready();
        try {
          (sdk.actions as any)?.setTitle?.('Catch the Stars — Music Edition');
        } catch {}
      } catch {}
    })();
    document.title = 'Catch the Stars — Music Edition';
  }, []);

  // start game when receipt is mined
  useEffect(() => {
    if (mined && pendingHash) {
      setHint('Payment confirmed — good luck!');
      setPendingHash(undefined);
      startCountdownThenPlay();
    }
  }, [mined, pendingHash]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctxRef.current = ctx;

    const audio = new Audio('https://cdn.pixabay.com/download/audio/2022/03/15/audio_74c715d9cf.mp3?filename=peaceful-ambient-11157.mp3');
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

    function drawBG() {
      const g = ctx.createLinearGradient(0, 0, 0, H.current);
      g.addColorStop(0, '#020018');
      g.addColorStop(1, '#150435');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W.current, H.current);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = COLORS[ri(0, COLORS.length - 1)];
        ctx.fillRect(ri(0, W.current), ri(0, H.current), 2, 2);
      }
    }

    function drawPlayer() {
      const p = player.current;
      ctx.fillStyle = '#9b59b6';
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }

    function drawObjects() {
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
    }

    function spawnObject() {
      const isStar = Math.random() < 0.8;
      const x = ri(10, W.current - 10);
      const size = rf(6, 12);
      const speed = BASE_SPEED + score * SPEED_INC;
      const color = isStar ? COLORS[ri(0, COLORS.length - 1)] : '#555';
      const type = isStar ? 'star' : 'rock';
      objects.current.push({ x, y: -10, size, color, speed, type });
    }

    function drawGameOver() {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W.current, H.current);
      ctx.fillStyle = '#FF4C4C';
      ctx.font = `bold ${Math.round(W.current * 0.08)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💥 GAME OVER 💥', W.current / 2, H.current / 2);
    }

    // prevent stacked loops across rerenders
    const loopAlive = { current: true };
    let raf = 0;

    function step() {
      if (!loopAlive.current) return;
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
              audioRef.current?.pause();
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
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W.current, H.current);
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(W.current * 0.2)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(countdown), W.current / 2, H.current / 2);
      }

      raf = requestAnimationFrame(step);
    }

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(step);

    return () => {
      loopAlive.current = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [countdown, score]);

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
          setHint('Catch stars & avoid rocks!');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  // unique memo to avoid wallet "no changes detected"
  function buildMemoData(): Hex {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    let hex = '0x';
    for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
    return hex as Hex;
  }

  /** Charge in Base ETH, then (on receipt) start */
  async function payThenStart() {
    if (!isConnected || !address) {
      setHint('Connect your wallet first!');
      return;
    }
    if (paying) return;

    if (PRICE_WEI <= BigInt(0)) {
      setHint('Config error: zero price');
      return;
    }

    setPaying(true);
    setHint('Opening wallet…');

    try {
      await sdk.actions.ready().catch(() => {});
      const inside = await sdk.isInMiniApp().catch(() => false);
      if (!inside) {
        setHint('Open inside Warpcast/Base App');
        return;
      }

      // ensure correct chain
      if (currentChainId !== CHAIN_ID) {
        try {
          await switchChainAsync({ chainId: CHAIN_ID });
        } catch {
          setHint('Please switch to Base');
          return;
        }
      }

      // add a tiny memo in data so each tx is unique
      const request = {
        to: TREASURY,
        value: PRICE_WEI,
        chainId: CHAIN_ID,
        data: buildMemoData(),
      } as const;

      const hash = await sendTransactionAsync(request);
      setHint('Waiting for confirmation…');
      setPendingHash(hash);
    } catch (err) {
      console.error(err);
      setHint('Transaction cancelled or blocked');
    } finally {
      setPaying(false);
    }
  }

  return (
    <div
      ref={wrapperRef}
      style={{ width: '100%', height: '100dvh', position: 'relative', background: '#000' }}
      onKeyDown={(e) => {
        if (e.code === 'Space') payThenStart();
      }}
      tabIndex={0}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', zIndex: 0, position: 'relative' }} />

      <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 8, zIndex: 10, alignItems: 'center' }}>
        <button onClick={payThenStart} style={btn} disabled={paying || waitingReceipt}>
          {waitingReceipt ? 'Confirming…' : paying ? 'Processing…' : 'Play'}
        </button>
        <button onClick={payThenStart} style={{ ...btn, background: '#2a1f3b' }} disabled={paying || waitingReceipt}>
          Restart
        </button>
        <ConnectWallet />
      </div>

      <div style={{ position: 'absolute', top: 12, right: 12, fontWeight: 800, color: '#fff', zIndex: 10 }}>{score}</div>
      <div style={{ position: 'absolute', left: 10, bottom: 10, color: '#b8a7d9', fontSize: 12, zIndex: 10 }}>{hint}</div>
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
