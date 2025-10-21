'use client';

import { useEffect, useRef, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scoreText, setScoreText] = useState('0');
  const [showStart, setShowStart] = useState(true);
  const [showOver, setShowOver] = useState(false);

  useEffect(() => {
    // tell Farcaster the UI is ready
    sdk.actions.ready();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    // crisp canvas on high DPI
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const W = 640;
    const H = 480;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    // game state
    let gameState: 'start' | 'playing' | 'over' = 'start';
    let score = 0;
    let frames = 0;
    let pipeGap = 350;
    const USERNAME = 'noel34';

    const bird = {
      x: 100,
      y: 320,
      velocity: 0,
      radius: 30,
      update() {
        if (gameState !== 'playing') return;
        this.velocity += 0.15;
        this.velocity *= 0.99;
        if (this.velocity > 8) this.velocity = 8;
        if (this.velocity < -10) this.velocity = -10;
        this.y += this.velocity;
        if (this.y > H - 50 - this.radius) endGame();
        if (this.y < 0) this.y = 0;
      },
      jump() {
        if (gameState === 'playing') this.velocity = -8;
      },
      draw() {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.x + 8, this.y - 5, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(this.x + 10, this.y - 5, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    class Pipe {
      x: number;
      width: number;
      gap: number;
      topHeight: number;
      scored: boolean;
      constructor() {
        this.x = W;
        this.width = 60;
        this.gap = pipeGap;
        this.topHeight = Math.random() * (H - this.gap - 200) + 50;
        this.scored = false;
      }
      update() {
        if (gameState !== 'playing') return;
        this.x -= 1.2;
      }
      draw() {
        ctx.fillStyle = '#9B59B6';
        ctx.fillRect(this.x, 0, this.width, this.topHeight);
        ctx.fillRect(this.x, this.topHeight + this.gap, this.width, H);

        ctx.strokeStyle = '#8E44AD';
        ctx.lineWidth = 3;
        ctx.strokeRect(this.x, 0, this.width, this.topHeight);
        ctx.strokeRect(this.x, this.topHeight + this.gap, this.width, H);
      }
      collidesWith(b: typeof bird) {
        if (b.x + b.radius > this.x && b.x - b.radius < this.x + this.width) {
          if (b.y - b.radius < this.topHeight || b.y + b.radius > this.topHeight + this.gap) {
            return true;
          }
        }
        return false;
      }
    }

    const pipes: Pipe[] = [];

    function updateDifficulty() {
      if (score <= 15) {
        pipeGap = Math.floor(350 / (1 + (score / 15) * 0.3));
      } else {
        const multiplier = 1.3 + ((score - 15) / 50) * 0.5;
        pipeGap = Math.floor(350 / Math.min(multiplier, 2));
      }
    }

    function drawBackground() {
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = '#553c9a';
      ctx.fillRect(0, H - 50, W, 50);
    }

    async function sendScore(username: string, scoreVal: number) {
      try {
        const res = await fetch('/api/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, score: scoreVal })
        });
        // ignore body to avoid JSON errors if route not set yet
        if (!res.ok) throw new Error('score not accepted');
      } catch (e) {
        console.error('sendScore failed', e);
      }
    }

    async function fetchLeaderboard() {
      try {
        const res = await fetch('/api/leaderboard');
        if (!res.ok) throw new Error('leaderboard not available');
        const leaderboard = await res.json();
        // you can render this into the DOM if you add a list, for now we log
        console.log('leaderboard', leaderboard);
      } catch (e) {
        console.error('leaderboard load failed', e);
      }
    }

    function endGame() {
      if (gameState !== 'playing') return;
      gameState = 'over';
      setShowOver(true);
      void sendScore(USERNAME, score).then(fetchLeaderboard);
    }

    function startGame() {
      gameState = 'playing';
      setShowStart(false);
      setShowOver(false);
      bird.y = 120;
      bird.velocity = 0;
      pipes.length = 0;
      score = 0;
      frames = 0;
      pipeGap = 350;
      setScoreText('0');
    }

    function loop() {
      frames++;
      drawBackground();

      if (gameState === 'playing') {
        updateDifficulty();
        bird.update();

        if (frames % 150 === 0) pipes.push(new Pipe());

        for (let i = pipes.length - 1; i >= 0; i--) {
          const p = pipes[i];
          p.update();
          p.draw();

          if (p.collidesWith(bird)) endGame();

          if (!p.scored && bird.x > p.x + p.width) {
            p.scored = true;
            score++;
            setScoreText(String(score));
          }

          if (p.x + p.width < 0) pipes.splice(i, 1);
        }
      } else {
        pipes.forEach((p) => p.draw());
      }

      bird.draw();
      requestAnimationFrame(loop);
    }

    function onCanvasClick() {
      bird.jump();
    }

    canvas.addEventListener('click', onCanvasClick);
    loop();

    return () => {
      canvas.removeEventListener('click', onCanvasClick);
    };
  }, []);

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 640 }}>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <button onClick={() => { /* start handled in effect via set states */ }} style={btnStyle} id="playBtn" />
            <button onClick={() => { /* restart handled below */ }} style={{ ...btnStyle, background: '#2a1f3b' }} id="restartBtn" />
          </div>
          <div style={{ fontWeight: 700 }} id="score">{scoreText}</div>
        </div>

        <canvas ref={canvasRef} id="canvas" />

        {showStart && (
          <div style={{ color: '#b8a7d9', fontSize: 12 }} id="start">Tap Play to start</div>
        )}
        {showOver && (
          <div style={{ color: '#b8a7d9', fontSize: 12 }} id="over">
            <span id="final">Game over</span>
          </div>
        )}

        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button
            style={btnStyle}
            onClick={() => {
              // trigger a start by toggling state then letting startGame run in effect land
              // simpler approach is to call a startGame ref
              // for this minimal page we reload the component to reset state
              window.location.reload();
            }}
          >
            Play
          </button>
          <button
            style={{ ...btnStyle, background: '#2a1f3b' }}
            onClick={() => window.location.reload()}
          >
            Restart
          </button>
          <span style={{ color: '#b8a7d9', fontSize: 12, marginLeft: 8 }}>
            Score {scoreText}
          </span>
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#8e44ad',
  color: '#fff',
  border: 'none',
  padding: '10px 14px',
  borderRadius: 12,
  fontWeight: 700,
  cursor: 'pointer'
};
