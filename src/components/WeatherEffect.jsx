import { useEffect, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'

// ── Particle factories ────────────────────────────────────────────────────────
function makeRain(w, h) {
  return Array.from({ length: 220 }, () => ({
    x:  Math.random() * w,
    y:  Math.random() * h,
    vy: 9 + Math.random() * 7,
    vx: -1.5 + Math.random() * 1,
    len: 12 + Math.random() * 9,
    op:  0.25 + Math.random() * 0.45,
  }))
}

function makeSnow(w, h) {
  return Array.from({ length: 140 }, () => ({
    x:  Math.random() * w,
    y:  Math.random() * h,
    r:  1 + Math.random() * 2.5,
    vy: 0.6 + Math.random() * 1.4,
    freq: 0.006 + Math.random() * 0.006,
    phase: Math.random() * Math.PI * 2,
    op:  0.55 + Math.random() * 0.35,
  }))
}

function makeHail(w, h) {
  return Array.from({ length: 180 }, () => ({
    x:  Math.random() * w,
    y:  Math.random() * h,
    r:  1.5 + Math.random() * 2,
    vy: 14 + Math.random() * 10,
    vx: -2 + Math.random() * 4,
    op:  0.6 + Math.random() * 0.35,
  }))
}

// ── Lightning branch ──────────────────────────────────────────────────────────
function drawBranch(ctx, x, y, len, angle, depth) {
  if (depth <= 0 || len < 6) return
  const rad = angle * (Math.PI / 180)
  const ex = x + len * Math.cos(rad)
  const ey = y + len * Math.sin(rad)
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(ex, ey)
  ctx.strokeStyle = `rgba(200,200,255,${0.25 + depth * 0.12})`
  ctx.lineWidth = depth * 0.6
  ctx.stroke()
  if (Math.random() < 0.55)
    drawBranch(ctx, ex, ey, len * 0.55, angle + (Math.random() - 0.5) * 60, depth - 1)
  drawBranch(ctx, ex, ey, len * 0.72, angle + (Math.random() - 0.5) * 30, depth - 1)
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function WeatherEffect() {
  const { weather } = useApp()
  const canvasRef    = useRef(null)
  const rafRef       = useRef(null)
  const particlesRef = useRef([])
  const lightningRef = useRef({ active: false, x: 0 })
  const weatherIdRef = useRef(weather?.id)
  const frameRef     = useRef(0)

  const resize = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    c.width  = window.innerWidth
    c.height = window.innerHeight
    const w = c.width, h = c.height
    const id = weatherIdRef.current
    if      (id === 'rain'    ) particlesRef.current = makeRain(w, h)
    else if (id === 'snowing' ) particlesRef.current = makeSnow(w, h)
    else if (id === 'hail'    ) particlesRef.current = makeHail(w, h)
    else if (id === 'storming') particlesRef.current = makeRain(w, h).map(p => ({ ...p, vy: p.vy * 1.5, op: p.op * 0.8 }))
    else particlesRef.current = []
  }, [])

  // Re-init particles on weather change
  useEffect(() => {
    weatherIdRef.current = weather?.id
    resize()
    // Lightning timer for storming
    if (weather?.id === 'storming') {
      const flash = () => {
        lightningRef.current = { active: true, x: Math.random() * window.innerWidth }
        setTimeout(() => { lightningRef.current = { active: false, x: 0 } }, 90)
      }
      const scheduleFlash = () => {
        const t = setTimeout(() => { flash(); scheduleFlash() }, 2800 + Math.random() * 5000)
        return t
      }
      const t = scheduleFlash()
      return () => clearTimeout(t)
    }
  }, [weather?.id, resize])

  useEffect(() => {
    window.addEventListener('resize', resize)
    resize()
    return () => window.removeEventListener('resize', resize)
  }, [resize])

  // ── Render loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const draw = () => {
      frameRef.current++
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)
      const id = weatherIdRef.current

      if (id === 'rain' || id === 'storming') {
        ctx.save()
        ctx.lineCap = 'round'
        for (const p of particlesRef.current) {
          ctx.strokeStyle = `rgba(120,170,255,${p.op})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x + p.vx * 0.3, p.y + p.len)
          ctx.stroke()
          p.x += p.vx; p.y += p.vy
          if (p.y > H) { p.y = -p.len; p.x = Math.random() * W }
          if (p.x < 0) p.x = W
        }
        // Lightning flash
        if (id === 'storming' && lightningRef.current.active) {
          ctx.globalAlpha = 0.55
          ctx.fillStyle = 'rgba(200,210,255,0.55)'
          ctx.fillRect(0, 0, W, H)
          ctx.globalAlpha = 1
          // Draw a bolt from top
          ctx.save()
          ctx.lineJoin = 'round'
          drawBranch(ctx, lightningRef.current.x, 0, 120 + Math.random() * 80, 85 + (Math.random() - 0.5) * 15, 5)
          ctx.restore()
        }
        ctx.restore()

      } else if (id === 'snowing') {
        ctx.save()
        for (const p of particlesRef.current) {
          ctx.fillStyle = `rgba(220,235,255,${p.op})`
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
          ctx.fill()
          p.x += Math.sin(frameRef.current * p.freq + p.phase) * 0.5
          p.y += p.vy
          if (p.y > H) { p.y = -p.r; p.x = Math.random() * W }
        }
        ctx.restore()

      } else if (id === 'hail') {
        ctx.save()
        for (const p of particlesRef.current) {
          ctx.fillStyle = `rgba(200,220,255,${p.op})`
          ctx.strokeStyle = 'rgba(160,200,255,0.6)'
          ctx.lineWidth = 0.5
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
          p.x += p.vx; p.y += p.vy
          if (p.y > H) { p.y = -p.r; p.x = Math.random() * W }
        }
        ctx.restore()

      } else if (id === 'foggy') {
        // Slow drifting fog bands
        const t = Date.now() / 12000
        ctx.save()
        for (let i = 0; i < 4; i++) {
          const bx = ((t + i * 0.25) % 1) * (W + 400) - 400
          const by = H * (0.2 + i * 0.2)
          const grad = ctx.createRadialGradient(bx, by, 0, bx, by, W * 0.55)
          grad.addColorStop(0,   'rgba(200,205,215,0.18)')
          grad.addColorStop(0.5, 'rgba(200,205,215,0.08)')
          grad.addColorStop(1,   'rgba(200,205,215,0)')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.ellipse(bx, by, W * 0.55, 80, 0, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()

      } else if (id === 'heatwave') {
        // Shimmering hot-air bands
        const t = Date.now() / 1800
        ctx.save()
        ctx.globalAlpha = 0.07
        for (let y = 0; y < H; y += 60) {
          const shift = Math.sin(t + y * 0.02) * 6
          const grad = ctx.createLinearGradient(0, y + shift, W, y + shift + 30)
          grad.addColorStop(0,   'rgba(255,120,0,0)')
          grad.addColorStop(0.5, 'rgba(255,100,30,0.7)')
          grad.addColorStop(1,   'rgba(255,120,0,0)')
          ctx.fillStyle = grad
          ctx.fillRect(0, y + shift, W, 30)
        }
        ctx.globalAlpha = 1
        ctx.restore()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  )
}
