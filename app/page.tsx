'use client'

import { useEffect, useRef, useState } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'
import ConnectWallet from '@/components/ConnectWallet'
import {
  useAccount,
  useSendTransaction,
  useWaitForTransactionReceipt,
  useChainId as useWagmiChainId,
  useSwitchChain,
} from 'wagmi'
import type { Hex } from 'viem'
import { parseEther, stringToHex } from 'viem'

const CHAIN_ID = 8453
const ri = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a
const rf = (a: number, b: number) => Math.random() * (b - a) + a

type Obj = { x: number; y: number; size: number; color: string; speed: number; type: 'star' | 'rock' }
const COLORS = ['#FFD700', '#FF69B4', '#00FFFF', '#ADFF2F', '#FFA500']
const PRICE_WEI = parseEther('0.00001')
const TREASURY: `0x${string}` = '0xa0E19656321CaBaF46d434Fa71B263AbB6959F07'

export default function Page() {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [score, setScore] = useState(0)
  const scoreRef = useRef(0)
  useEffect(() => { scoreRef.current = score }, [score])

  const [hint, setHint] = useState('Press Play or Space to start')
  const [countdown, setCountdown] = useState(0)
  const [paying, setPaying] = useState(false)
  const [pendingHash, setPendingHash] = useState<`0x${string}` | undefined>(undefined)
  const [uiPhase, setUiPhase] = useState<'start' | 'countdown' | 'playing' | 'over'>('start')

  const { isConnected, address } = useAccount()
  const { sendTransactionAsync } = useSendTransaction()
  const { switchChainAsync } = useSwitchChain()
  const currentChainId = useWagmiChainId()
  const { isSuccess: mined, isLoading: waitingReceipt } = useWaitForTransactionReceipt({
    hash: pendingHash,
    chainId: CHAIN_ID,
    confirmations: 1,
    query: { enabled: !!pendingHash },
  })

  const state = useRef<'start' | 'countdown' | 'playing' | 'over'>('start')
  const objects = useRef<Obj[]>([])
  const player = useRef({ x: 200, y: 420, w: 70, h: 20, vx: 0 })
  const frames = useRef(0)
  const W = useRef(640)
  const H = useRef(480)
  const OBJECT_SPAWN_INTERVAL = 100
  const BASE_SPEED = 0.4
  const SPEED_INC = 0.01
  const KEY = useRef({ left: false, right: false })
  const MOVE_ACCEL = 0.9
  const MOVE_MAX = 8
  const FRICTION = 0.85

  const sessionSalt = useRef<string>('')
  if (!sessionSalt.current) {
    const b = new Uint8Array(6)
    crypto.getRandomValues(b)
    sessionSalt.current = Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('')
  }
  const attemptRef = useRef(0)
  const clickLockUntil = useRef(0)

  useEffect(() => {
    ;(async () => {
      try {
        await sdk.actions.ready()
        try { (sdk.actions as any)?.setTitle?.('Catch the Stars  Music Edition') } catch {}
      } catch {}
    })()
    document.title = 'Catch the Stars  Music Edition'
  }, [])

  useEffect(() => {
    if (mined && pendingHash) {
      setHint('Payment confirmed  good luck')
      setPendingHash(undefined)
      startCountdownThenPlay()
    }
  }, [mined, pendingHash])

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') { if (!playDisabled) void payThenStart(); return }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') KEY.current.left = true
      if (e.code === 'ArrowRight' || e.code === 'KeyD') KEY.current.right = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') KEY.current.left = false
      if (e.code === 'ArrowRight' || e.code === 'KeyD') KEY.current.right = false
    }
    const onMouseMove = (e: MouseEvent) => {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
      const x = e.clientX - rect.left
      player.current.x = Math.max(0, Math.min(W.current - player.current.w, x - player.current.w / 2))
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!e.touches[0]) return
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
      const x = e.touches[0].clientX - rect.left
      player.current.x = Math.max(0, Math.min(W.current - player.current.w, x - player.current.w / 2))
    }

    el.addEventListener('keydown', onKeyDown)
    el.addEventListener('keyup', onKeyUp)
    el.addEventListener('mousemove', onMouseMove)
    el.addEventListener('touchmove', onTouchMove, { passive: true })

    return () => {
      el.removeEventListener('keydown', onKeyDown)
      el.removeEventListener('keyup', onKeyUp)
      el.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

  // SAFE CANVAS INIT
  useEffect(() => {
    const canvasEl = canvasRef.current
    if (!canvasEl) return
    const ctx = canvasEl.getContext('2d')
    if (!ctx) return
    ctxRef.current = ctx

    const audio = new Audio('https://cdn.pixabay.com/download/audio/2022/03/15/audio_74c715d9cf.mp3?filename=peaceful-ambient-11157.mp3')
    audio.loop = true
    audio.volume = 0.3
    audioRef.current = audio

    const resize = () => {
      const wrap = wrapperRef.current || document.body
      const w = Math.max(1, wrap.clientWidth)
      const h = Math.floor(w / (9 / 16))
      const dpr = window.devicePixelRatio || 1
      canvasEl.width = w * dpr
      canvasEl.height = h * dpr
      canvasEl.style.width = `${w}px`
      canvasEl.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      W.current = w; H.current = h
      player.current.y = H.current - 40
    }

    resize()
    window.addEventListener('resize', resize)

    let raf: number
    let alive = true

    const drawBG = () => {
      const g = ctx.createLinearGradient(0, 0, 0, H.current)
      g.addColorStop(0, '#020018'); g.addColorStop(1, '#150435')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W.current, H.current)
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = COLORS[ri(0, COLORS.length - 1)]
        ctx.fillRect(ri(0, W.current), ri(0, H.current), 2, 2)
      }
    }

    const drawPlayer = () => { const p = player.current; ctx.fillStyle = '#9b59b6'; ctx.fillRect(p.x, p.y, p.w, p.h) }

    const drawObjects = () => {
      for (const o of objects.current) {
        if (o.type === 'rock') {
          ctx.fillStyle = '#444'
          ctx.beginPath(); ctx.arc(o.x, o.y, 12, 0, Math.PI * 2); ctx.fill()
          ctx.strokeStyle = '#bbb'; ctx.lineWidth = 2; ctx.stroke()
        } else {
          ctx.fillStyle = o.color
          ctx.beginPath(); ctx.arc(o.x, o.y, o.size, 0, Math.PI * 2); ctx.fill()
        }
      }
    }

    const spawnObject = () => {
      const isStar = Math.random() < 0.8
      const x = ri(10, W.current - 10)
      const size = rf(6, 12)
      const speed = BASE_SPEED + scoreRef.current * SPEED_INC
      const color = isStar ? COLORS[ri(0, COLORS.length - 1)] : '#555'
      const type = isStar ? 'star' : 'rock'
      objects.current.push({ x, y: -10, size, color, speed, type })
    }

    const drawGameOver = () => {
      const w = W.current, h = H.current
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#FF4C4C'
      ctx.font = `bold ${Math.round(w * 0.08)}px Arial`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('💥 GAME OVER 💥', w / 2, h / 2)
    }

    const step = () => {
      if (!alive) return
      frames.current++
      drawBG()

      if (state.current === 'playing') {
        const p = player.current
        if (KEY.current.left) p.vx -= MOVE_ACCEL
        if (KEY.current.right) p.vx += MOVE_ACCEL
        p.vx *= FRICTION
        p.vx = Math.max(-MOVE_MAX, Math.min(MOVE_MAX, p.vx))
        p.x = Math.max(0, Math.min(W.current - p.w, p.x + p.vx))
      }

      if (state.current === 'playing') {
        if (frames.current % OBJECT_SPAWN_INTERVAL === 0) spawnObject()
        for (let i = objects.current.length - 1; i >= 0; i--) {
          const o = objects.current[i]; o.y += o.speed
          const p = player.current
          const hitX = o.x > p.x && o.x < p.x + p.w
          const hitY = o.y + o.size > p.y && o.y - o.size < p.y + p.h
          if (hitX && hitY) {
            if (o.type === 'star') { setScore(s => s + 1); objects.current.splice(i, 1) }
            else {
              state.current = 'over'; setUiPhase('over'); setHint('💥 GAME OVER  you hit a rock')
              drawGameOver(); audioRef.current?.pause()
            }
          } else if (o.y > H.current + 20) objects.current.splice(i, 1)
        }
      }

      drawObjects(); drawPlayer()

      if (state.current === 'countdown' && countdown > 0) {
        const w = W.current, h = H.current
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = '#fff'
        ctx.font = `bold ${Math.round(w * 0.2)}px Arial`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(String(countdown), w / 2, h / 2)
      }

      raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    setTimeout(() => wrapperRef.current?.focus?.(), 0)
    return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [countdown])

  function startCountdownThenPlay() {
    objects.current = []; setScore(0); player.current.vx = 0
    state.current = 'countdown'; setUiPhase('countdown'); setHint('Get Ready ✨'); setCountdown(3)
    if (audioRef.current) { audioRef.current.currentTime = 0; void audioRef.current.play().catch(() => {}) }
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timer); state.current = 'playing'; setUiPhase('playing'); setHint('Catch stars and avoid rocks'); return 0 }
        return c - 1
      })
    }, 1000)
  }

  function playClickGuard() {
    const now = Date.now(); if (now < clickLockUntil.current) return false
    clickLockUntil.current = now + 1500; return true
  }

  async function payThenStart() {
    if (!isConnected || !address) return setHint('Connect your wallet first')
    if (!['start', 'over'].includes(state.current)) return setHint('Finish the round first')
    if (paying || waitingReceipt || pendingHash) return
    if (!playClickGuard()) return
    setPaying(true); setHint('Opening wallet')

    const buildTx = (a: number, withData: boolean) => {
      const bump = BigInt((Date.now() % 19) + 1 + a)
      const value = PRICE_WEI + bump
      const baseTip = BigInt(100000000)
      const jitter = BigInt(Math.floor(Math.random() * 30)) * BigInt(1000000)
      const maxPriorityFeePerGas = baseTip + jitter
      const maxFeePerGas = maxPriorityFeePerGas + BigInt(1000000)
      const tx: any = { to: TREASURY, value, chainId: CHAIN_ID, maxFeePerGas, maxPriorityFeePerGas, type: 'eip1559' }
      if (withData) { attemptRef.current += 1; tx.data = stringToHex(`play:${Date.now()}:${sessionSalt.current}:${attemptRef.current}`) }
      return tx
    }

    const trySend = async (a: number) => {
      if (currentChainId !== CHAIN_ID) { try { await switchChainAsync({ chainId: CHAIN_ID }) } catch { throw new Error('switch') } }
      try { return await sendTransactionAsync(buildTx(a, false)) }
      catch (e: any) {
        const msg = String(e?.message || e)
        if (/no changes detected|already known|identical|nothing to do/i.test(msg)) return await sendTransactionAsync(buildTx(a, true))
        throw e
      }
    }

    try {
      await sdk.actions.ready().catch(() => {}); const inside = await sdk.isInMiniApp().catch(() => false)
      if (!inside) setHint('Tip  best inside Warpcast or Base')
      let hash: `0x${string}` | undefined
      for (let i = 0; i < 3 && !hash; i++) {
        try { hash = await trySend(i) }
        catch (e: any) {
          const msg = String(e?.message || e)
          if (/user rejected|denied|cancel/i.test(msg)) { setHint('Transaction cancelled'); break }
          if (msg === 'switch') { setHint('Please switch to Base'); break }
          if (/no changes detected|already known|identical|nothing to do/i.test(msg)) { setHint('Refreshing tx'); continue }
          if (i === 2) throw e
        }
      }
      if (!hash) return setHint('Could not create transaction')
      setHint('Waiting for confirmation'); setPendingHash(hash)
    } catch (err) { console.error(err); setHint('Transaction failed') } finally { setPaying(false) }
  }

  const playDisabled = paying || waitingReceipt || !!pendingHash

  return (
    <div ref={wrapperRef} tabIndex={0} style={{ width: '100%', height: '100dvh', position: 'relative', background: '#000', outline: 'none' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', zIndex: 0, position: 'relative' }} />
      <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 8, zIndex: 10, alignItems: 'center' }}>
        <button onClick={payThenStart} style={btn} disabled={playDisabled}>
          {waitingReceipt ? 'Confirming…' : paying ? 'Processing…' : uiPhase === 'over' ? 'Restart' : 'Play'}
        </button>
        <ConnectWallet />
      </div>
      <div style={{ position: 'absolute', top: 12, right: 12, fontWeight: 800, color: '#fff', zIndex: 10 }}>{score}</div>
      <div style={{ position: 'absolute', left: 10, bottom: 10, color: '#b8a7d9', fontSize: 12, zIndex: 10 }}>{hint}</div>
    </div>
  )
}

const btn: React.CSSProperties = {
  background: '#8e44ad',
  color: '#fff',
  border: 'none',
  padding: '10px 14px',
  borderRadius: 12,
  fontWeight: 700,
  cursor: 'pointer',
}