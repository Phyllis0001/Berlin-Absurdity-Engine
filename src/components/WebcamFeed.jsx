import { useEffect, useRef, useState, useCallback } from 'react'
import { useApp } from '../context/AppContext'

// ── face-api lazy singleton ────────────────────────────────────────────────────
let _faceapiPromise = null
function getFaceApi() {
  if (!_faceapiPromise) {
    _faceapiPromise = import('face-api.js').then(async (faceapi) => {
      const URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights'
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(URL),
        faceapi.nets.faceExpressionNet.loadFromUri(URL),
      ])
      return faceapi
    })
  }
  return _faceapiPromise
}

// ── Dimensions ────────────────────────────────────────────────────────────────
const CAM_W = 1280, CAM_H = 720
const W = 480, H = 270

// ── Nonsense Hierarchy messages ───────────────────────────────────────────────
// Level 1 → lost | Level 2 → tooClose | Level 3 → faceDetected | Level 4a → motion | Level 4b → still
const LOGS = {
  lost:         { display: '[LOST] Where did you go? Sector is getting lonely.',     tts: 'Where did you go?' },
  tooClose:     { display: '[DANGER] Too close! You are breaking the pixels!',        tts: 'Back away. You are breaking the pixels.' },
  faceDetected: { display: '[OK] Face detected. Analysis: 100% weird energy.',        tts: 'Weird energy detected.' },
  motion:       { display: '[!] Movement too messy. Is that a ghost or a human?',     tts: 'Is that a ghost or a human?' },
  still:        { display: '[?] Subject is very still. Maybe it is a statue.',        tts: 'Are you a statue?' },
}

// ── TTS — robotic female voice ────────────────────────────────────────────────
function speak(ttsText) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(ttsText)
  utt.rate = 0.82; utt.pitch = 1.18; utt.volume = 0.9
  const doSpeak = () => {
    const voices = window.speechSynthesis.getVoices()
    const pick =
      voices.find(v => v.lang.startsWith('en') && /zira|samantha|karen|victoria|fiona|alice|susan/i.test(v.name)) ||
      voices.find(v => v.lang === 'en-US') ||
      voices.find(v => v.lang.startsWith('en'))
    if (pick) utt.voice = pick
    window.speechSynthesis.speak(utt)
  }
  if (window.speechSynthesis.getVoices().length) doSpeak()
  else { window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; doSpeak() } }
}

// ── Canvas helpers ────────────────────────────────────────────────────────────
function drawNoise(ctx) {
  const img = ctx.createImageData(W, H); const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const l = (Math.random() * 255 * 0.20) | 0
    d[i] = (l * 0.08) | 0; d[i+1] = (l * 0.85) | 0; d[i+2] = (l * 0.08) | 0; d[i+3] = 255
  }
  ctx.putImageData(img, 0, 0)
}

function drawScanBar(ctx, ts) {
  const y = ((ts / 2200) % 1) * H
  ctx.save()
  const g = ctx.createLinearGradient(0, y - 16, 0, y + 16)
  g.addColorStop(0, 'rgba(0,255,65,0)'); g.addColorStop(0.5, 'rgba(0,255,65,0.18)'); g.addColorStop(1, 'rgba(0,255,65,0)')
  ctx.fillStyle = g; ctx.fillRect(0, y - 16, W, 32)
  ctx.strokeStyle = 'rgba(0,255,65,0.35)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  ctx.restore()
}

function fmtLabel(raw, idx) {
  if (!raw) return `CAM_${idx + 1}`
  return raw.replace(/\(built[- ]?in\)/i, '(INT)').replace(/USB\s*/i, 'USB-')
    .replace(/\bcamera\b/i, 'CAM').replace(/\bwebcam\b/i, 'WEB').replace(/\bintegrated\b/i, 'INT')
    .trim().toUpperCase().slice(0, 20)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function WebcamFeed() {
  const { triggerBioAlert } = useApp()

  // DOM / stream refs
  const canvasRef       = useRef(null)
  const videoRef        = useRef(null)   // raw unfiltered video — face-api.js reads this directly
  const streamRef       = useRef(null)
  const rafRef          = useRef(null)
  const faceapiRef      = useRef(null)
  const detectingRef    = useRef(false)
  const detectInterRef  = useRef(null)
  const offscreenRef    = useRef(null)   // tiny 80×45 canvas for motion pixel-diff
  const prevFrameRef    = useRef(null)   // reused Uint8ClampedArray — no per-frame alloc

  // Motion (written in rAF loop, read in detection loop — both are refs, no race condition)
  const motionScoreRef  = useRef(0)      // exponentially smoothed 0–100
  const lastHighMotionTs= useRef(0)      // timestamp of last frame where motion > threshold

  // HUD bar smooth float targets
  const humanGlitchRef  = useRef(0)
  const realityStabRef  = useRef(100)

  // Log / TTS state
  const lastLogKeyRef   = useRef(null)
  const lastSpokenTs    = useRef(0)
  const soundEnabledRef = useRef(false)
  const triggerRef      = useRef(triggerBioAlert)

  // Face tracking
  const faceWasHereRef  = useRef(false)

  // React state for rendering
  const [minimized,    setMinimized]    = useState(false)
  const [camActive,    setCamActive]    = useState(false)
  const [camError,     setCamError]     = useState(null)
  const [modelStatus,  setModelStatus]  = useState('idle')
  const [faceDetected, setFaceDetected] = useState(false)
  const [faceBox,      setFaceBox]      = useState(null)
  const [devices,      setDevices]      = useState([])
  const [selectedId,   setSelectedId]   = useState(null)
  const [switching,    setSwitching]    = useState(false)
  const [humanGlitch,  setHumanGlitch]  = useState(0)
  const [realityStab,  setRealityStab]  = useState(100)
  const [logKey,       setLogKey]       = useState(null)
  const [soundOn,      setSoundOn]      = useState(false)

  useEffect(() => { triggerRef.current     = triggerBioAlert }, [triggerBioAlert])
  useEffect(() => { soundEnabledRef.current = soundOn        }, [soundOn])

  // ── Load face-api models ───────────────────────────────────────────────────
  useEffect(() => {
    setModelStatus('loading')
    getFaceApi()
      .then(fa => { faceapiRef.current = fa; setModelStatus('ready') })
      .catch(()  => setModelStatus('error'))
  }, [])

  // ── Device enumeration ────────────────────────────────────────────────────
  const refreshDevices = useCallback(async () => {
    try {
      const vids = (await navigator.mediaDevices.enumerateDevices())
        .filter(d => d.kind === 'videoinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: fmtLabel(d.label, i) }))
      setDevices(vids)
      setSelectedId(prev => prev ?? (vids[0]?.deviceId || null))
    } catch (_) {}
  }, [])

  useEffect(() => {
    refreshDevices()
    navigator.mediaDevices?.addEventListener('devicechange', refreshDevices)
    return () => navigator.mediaDevices?.removeEventListener('devicechange', refreshDevices)
  }, [refreshDevices])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null; videoRef.current = null
  }, [])
  useEffect(() => () => stopStream(), [stopStream])

  const startCamWithId = useCallback(async (deviceId) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width:  { ideal: CAM_W },
        height: { ideal: CAM_H },
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
      audio: false,
    })
    streamRef.current = stream
    const vid = document.createElement('video')
    vid.srcObject = stream; vid.playsInline = true; vid.muted = true
    await vid.play()
    videoRef.current = vid
    // Tiny offscreen canvas for motion detection — reads raw video, no CSS filter
    const oc = document.createElement('canvas')
    oc.width = 80; oc.height = 45
    offscreenRef.current = oc
    prevFrameRef.current = null
    // Initialise so "still" doesn't fire the moment the camera opens
    lastHighMotionTs.current = Date.now()
  }, [])

  const startCam = useCallback(async () => {
    try {
      await startCamWithId(selectedId)
      setCamActive(true); setCamError(null); refreshDevices()
    } catch (err) { setCamError(err.message ?? 'CAMERA_DENIED') }
  }, [selectedId, startCamWithId, refreshDevices])

  const switchCamera = useCallback(async (deviceId) => {
    if (deviceId === selectedId && camActive) return
    setSelectedId(deviceId)
    if (!camActive) return
    setSwitching(true); setFaceDetected(false); setFaceBox(null)
    prevFrameRef.current = null; stopStream()
    try {
      await startCamWithId(deviceId); setCamError(null)
    } catch (err) { setCamError(err.message ?? 'CAMERA_DENIED'); setCamActive(false) }
    finally { setSwitching(false) }
  }, [selectedId, camActive, stopStream, startCamWithId])

  // ── Face detection — ~3 fps ───────────────────────────────────────────────
  //
  // face-api.js reads videoRef.current — the raw, unfiltered HTMLVideoElement.
  // The CSS filter on <canvas className="wcf-canvas--nv"> is a purely visual
  // effect applied by the browser compositor AFTER the pixels are drawn.
  // It is invisible to JavaScript and never touches the detection pipeline.
  //
  useEffect(() => {
    if (modelStatus !== 'ready' || !camActive) return
    const faceapi = faceapiRef.current

    const detect = async () => {
      const vid = videoRef.current
      if (!vid || vid.readyState < 2 || detectingRef.current) return
      detectingRef.current = true
      try {
        // ── Detection on the raw video stream (no filter applied) ─────────
        const dets = await faceapi
          .detectAllFaces(vid, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 }))
          .withFaceExpressions()

        const now   = Date.now()
        const found = dets.length > 0
        const vW    = vid.videoWidth  || CAM_W
        const vH    = vid.videoHeight || CAM_H

        faceWasHereRef.current = found

        // ── Update faceBox state for the SVG reticle ──────────────────────
        if (!found) {
          setFaceDetected(false)
          setFaceBox(null)
        } else {
          const box = dets[0].detection.box
          setFaceDetected(true)
          setFaceBox({
            // Mirror x-axis to match the selfie-flipped canvas
            x:      (vW - box.x - box.width) * (W / vW),
            y:      box.y * (H / vH),
            width:  box.width  * (W / vW),
            height: box.height * (H / vH),
          })
        }

        // ── Nonsense Hierarchy ────────────────────────────────────────────
        // Read motion score that was computed in the rAF loop
        const motion     = motionScoreRef.current
        const highMotion = motion > 28
        const stillFor3s = found && (now - lastHighMotionTs.current) > 3000

        let newKey
        if (!found) {
          // LEVEL 1 — Presence check
          newKey = 'lost'
        } else {
          const rawBox   = dets[0].detection.box
          const tooClose = (rawBox.width / vW) > 0.70 || (rawBox.height / vH) > 0.70

          if (tooClose)        newKey = 'tooClose'     // LEVEL 2 — Proximity
          else if (highMotion) newKey = 'motion'        // LEVEL 4a — Movement
          else if (stillFor3s) newKey = 'still'         // LEVEL 4b — No movement 3s+
          else                 newKey = 'faceDetected'  // LEVEL 3 — Identity (default)
        }

        // ── Log update with 3-second TTS cooldown ────────────────────────
        const changed = newKey !== lastLogKeyRef.current
        const ageMs   = now - lastSpokenTs.current

        if (changed) {
          lastLogKeyRef.current = newKey
          setLogKey(newKey)
          // TTS fires on state change, but not faster than every 3 s
          if (soundEnabledRef.current && ageMs > 3000) {
            lastSpokenTs.current = now
            speak(LOGS[newKey].tts)
          }
          if (newKey !== 'still') triggerRef.current()
        } else if (soundEnabledRef.current && ageMs > 8000) {
          // Re-announce after 8 s of the same state so it never goes silent
          lastSpokenTs.current = now
          speak(LOGS[newKey].tts)
        }

        // ── REALITY STABILITY drops on any anomaly ────────────────────────
        // Any face presence = -30, high motion adds up to -50, too close = extra -20
        const rawBox2  = found ? dets[0].detection.box : null
        const tc       = rawBox2 && ((rawBox2.width / vW) > 0.70 || (rawBox2.height / vH) > 0.70)
        const facePen  = found      ? 30 : 0
        const motPen   = highMotion ? Math.min(50, motion * 0.50) : 0
        const tcPen    = tc         ? 20 : 0
        const target   = Math.max(0, 100 - facePen - motPen - tcPen)
        realityStabRef.current = realityStabRef.current * 0.85 + target * 0.15
        setRealityStab(Math.round(realityStabRef.current))

      } catch (_) {}
      finally { detectingRef.current = false }
    }

    detectInterRef.current = setInterval(detect, 333)   // ~3 fps — respects throttle requirement
    return () => clearInterval(detectInterRef.current)
  }, [modelStatus, camActive])

  // ── Canvas render + motion scoring — rAF ─────────────────────────────────
  //
  // Responsibilities of this loop:
  //   1. Draw the mirrored video to canvas  (the CSS filter turns it NV green — visual only)
  //   2. Compute a motion score via pixel-diff on a tiny raw-video offscreen canvas
  //   3. Smooth the HUMAN GLITCH bar toward the motion score
  //
  // It does NOT update logKey or realityStab — that is the detection loop's job.
  //
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = W; canvas.height = H

    const draw = () => {
      const ts  = Date.now()
      const vid = videoRef.current

      if (vid && vid.readyState >= 2) {
        // Render mirrored video to canvas
        // The wcf-canvas--nv CSS filter is applied by the browser AFTER this draw call
        // and has zero effect on the raw pixel data in `curr` below.
        ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1)
        ctx.drawImage(vid, 0, 0, W, H); ctx.restore()
        ctx.fillStyle = 'rgba(0,14,4,0.36)'; ctx.fillRect(0, 0, W, H)

        // ── Pixel-diff motion detection on raw video (no filter) ──────────
        const oc = offscreenRef.current
        if (oc) {
          const oc2d = oc.getContext('2d')
          oc2d.drawImage(vid, 0, 0, 80, 45)            // reads raw video pixels directly
          const curr = oc2d.getImageData(0, 0, 80, 45).data

          if (prevFrameRef.current) {
            const prev = prevFrameRef.current
            let diff = 0
            // Sample every 4th pixel (stride 16 bytes) — fast, good enough approximation
            for (let i = 0; i < curr.length; i += 16)
              diff += Math.abs(curr[i]   - prev[i])
                    + Math.abs(curr[i+1] - prev[i+1])
                    + Math.abs(curr[i+2] - prev[i+2])
            const rawScore = Math.min(100, (diff / (curr.length / 16)) * 2.8)
            // Exponential smoothing: fast rise, slow decay
            motionScoreRef.current = motionScoreRef.current * 0.78 + rawScore * 0.22
            if (motionScoreRef.current > 28) lastHighMotionTs.current = ts
          }

          // Reuse buffer — avoids a GC allocation every frame at 60 fps
          if (!prevFrameRef.current) { prevFrameRef.current = new Uint8ClampedArray(curr) }
          else                        { prevFrameRef.current.set(curr) }
        }

        // HUMAN GLITCH bar lags behind motion score for a smoother feel
        humanGlitchRef.current = humanGlitchRef.current * 0.82 + motionScoreRef.current * 0.18
        setHumanGlitch(Math.round(humanGlitchRef.current))
      } else {
        // Camera offline — show noise and let bars decay toward 0 / 100
        drawNoise(ctx); drawScanBar(ctx, ts)
        motionScoreRef.current  *= 0.90
        humanGlitchRef.current  *= 0.90
        realityStabRef.current   = Math.min(100, realityStabRef.current * 0.95 + 5)
        setHumanGlitch(Math.round(humanGlitchRef.current))
        setRealityStab(Math.round(realityStabRef.current))
      }

      // Subtle scanline band + ISO timestamp
      const band = (ts / 160) % H
      ctx.fillStyle = 'rgba(0,255,80,0.022)'; ctx.fillRect(0, band, W, 5)
      ctx.fillStyle = 'rgba(255,107,0,0.45)'; ctx.font = 'bold 9px "Courier New"'
      ctx.fillText(new Date().toISOString().replace('T', '  ').slice(0, 22), 5, H - 5)

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])   // empty deps — only reads/writes refs, no stale-closure risk

  // ── Derived SVG values ────────────────────────────────────────────────────
  const P = 5, BL = 16
  const brackets = faceBox ? (() => {
    const { x, y, width: bw, height: bh } = faceBox
    const lx = x - P, rx = x + bw + P, ty = y - P, by = y + bh + P
    return [
      `M${lx+BL},${ty} L${lx},${ty} L${lx},${ty+BL}`,
      `M${rx-BL},${ty} L${rx},${ty} L${rx},${ty+BL}`,
      `M${lx+BL},${by} L${lx},${by} L${lx},${by-BL}`,
      `M${rx-BL},${by} L${rx},${by} L${rx},${by-BL}`,
    ]
  })() : []
  const fcx        = faceBox ? faceBox.x + faceBox.width  / 2 : 0
  const fcy        = faceBox ? faceBox.y + faceBox.height / 2 : 0
  const showSelect = devices.length > 1
  const currentLog = logKey ? LOGS[logKey] : null
  const isAlert    = logKey === 'lost' || logKey === 'tooClose'

  return (
    <div className="wcf-container">

      {/* ── Header ── */}
      <div className="wcf-header">
        <span className={`wcf-dot${camActive ? '' : ' wcf-dot--off'}`} />
        GLITCH-CAM&nbsp;//&nbsp;SECTOR&nbsp;7G
        <div className="wcf-header-actions">
          <button
            className={`wcf-sound-btn${soundOn ? ' wcf-sound-btn--on' : ''}`}
            onClick={() => setSoundOn(s => !s)}
            title={soundOn ? 'Sound ON — click to mute' : 'Sound OFF — click to enable'}
          >
            {soundOn ? '◉' : '◎'}&nbsp;SND
          </button>
          {!camActive && <button className="wcf-cam-btn" onClick={startCam}>CAM</button>}
          <button className="wcf-toggle" onClick={() => setMinimized(m => !m)}>
            {minimized ? '▲' : '▼'}
          </button>
        </div>
      </div>

      <div className="wcf-body" style={{ display: minimized ? 'none' : 'block' }}>
        {camError && <div className="wcf-error">ACCESS_DENIED // {camError}</div>}
        {modelStatus === 'loading' && (
          <div className="wcf-model-status wcf-model-status--loading">◈ LOADING GLITCH DETECTION...</div>
        )}
        {modelStatus === 'error' && (
          <div className="wcf-model-status wcf-model-status--err">⚠ MODEL_LOAD_FAILED // DEGRADED MODE</div>
        )}
        {switching && (
          <div className="wcf-model-status wcf-model-status--loading">◈ SWITCHING INPUT SOURCE...</div>
        )}
        {modelStatus === 'ready' && camActive && !faceDetected && !switching && (
          <div className="wcf-model-status wcf-model-status--scan">◈ SCANNING FOR DIGITAL GLITCH...</div>
        )}

        <div className="wcf-canvas-wrap">

          {/* The CSS class wcf-canvas--nv applies the NV green filter visually.
              This is a browser compositor effect. JavaScript — including face-api.js —
              never sees filtered pixels. Detection always runs on the raw video stream. */}
          <canvas ref={canvasRef} className="wcf-canvas wcf-canvas--nv" />

          {/* ── HUD Bars — overlaid on top of the NV canvas ── */}
          {camActive && (
            <div className="wcf-hud-bars">
              <div className="wcf-hud-bar-row">
                <span className="wcf-hud-label">HUMAN GLITCH</span>
                <div className="wcf-hud-track">
                  <div className="wcf-hud-fill wcf-hud-fill--glitch" style={{ width: `${humanGlitch}%` }} />
                </div>
                <span className="wcf-hud-pct">{humanGlitch}%</span>
              </div>
              <div className="wcf-hud-bar-row">
                <span className="wcf-hud-label">REALITY STBL</span>
                <div className="wcf-hud-track">
                  <div
                    className={`wcf-hud-fill wcf-hud-fill--reality${realityStab < 30 ? ' wcf-hud-fill--critical' : ''}`}
                    style={{ width: `${realityStab}%` }}
                  />
                </div>
                <span className="wcf-hud-pct">{realityStab}%</span>
              </div>
            </div>
          )}

          {/* ── SVG reticle ── */}
          <svg className="wcf-reticle-svg" viewBox={`0 0 ${W} ${H}`}>
            <defs>
              <filter id="wcf-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b" />
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            {[`M4,18 L4,4 L18,4`, `M${W-18},4 L${W-4},4 L${W-4},18`,
              `M4,${H-18} L4,${H-4} L18,${H-4}`, `M${W-18},${H-4} L${W-4},${H-4} L${W-4},${H-18}`
            ].map((d, i) => <path key={i} d={d} fill="none" stroke="rgba(0,255,65,0.40)" strokeWidth="1.5" />)}
            <text x={W/2} y="13" textAnchor="middle"
              fill={faceDetected ? '#00FF41' : 'rgba(0,255,65,0.35)'}
              fontSize="9" fontFamily="'Courier New',monospace" letterSpacing="1">
              {faceDetected ? 'GLITCH_DETECTED' : camActive ? 'SCANNING_SECTOR' : 'CAM_OFFLINE'}
            </text>
            {brackets.map((d, i) => (
              <path key={`b${i}`} d={d} fill="none" stroke="#00FF41" strokeWidth="2.2" filter="url(#wcf-glow)" />
            ))}
            {faceBox && (<>
              <line x1={fcx-13} y1={fcy} x2={fcx-4}  y2={fcy} stroke="#00FF41" strokeWidth="1.5" opacity="0.85" />
              <line x1={fcx+4}  y1={fcy} x2={fcx+13} y2={fcy} stroke="#00FF41" strokeWidth="1.5" opacity="0.85" />
              <line x1={fcx} y1={fcy-13} x2={fcx} y2={fcy-4}  stroke="#00FF41" strokeWidth="1.5" opacity="0.85" />
              <line x1={fcx} y1={fcy+4}  x2={fcx} y2={fcy+13} stroke="#00FF41" strokeWidth="1.5" opacity="0.85" />
              <ellipse cx={fcx} cy={fcy}
                rx={faceBox.width/2+P} ry={faceBox.height/2+P}
                fill="none" stroke="rgba(0,255,65,0.30)" strokeWidth="1" strokeDasharray="5 6" />
              <text x={faceBox.x-P} y={faceBox.y-P-9}
                fill="#00FF41" fontSize="8.5" fontFamily="'Courier New',monospace"
                letterSpacing="0.5" opacity="0.9" filter="url(#wcf-glow)">GLITCH_001</text>
            </>)}
            <text x={W-6} y={H-5} textAnchor="end"
              fill="rgba(0,255,65,0.50)" fontSize="8" fontFamily="'Courier New',monospace">
              NV-MODE&nbsp;|&nbsp;GLITCH-CAM
            </text>
          </svg>
        </div>

        {/* ── Glitch log ── */}
        {camActive && currentLog && (
          <div className={`wcf-glitch-log${isAlert ? ' wcf-glitch-log--alert' : ''}`}>
            <span className="wcf-glitch-log-cursor">▶</span>
            <span className="wcf-glitch-log-text">{currentLog.display}</span>
          </div>
        )}

        {/* ── Camera input selector (shown when 2+ devices detected) ── */}
        {showSelect && (
          <div className="wcf-cam-select">
            <span className="wcf-cam-select-label">INPUT&nbsp;SOURCE</span>
            <div className="wcf-cam-options">
              {devices.map((dev, i) => (
                <button
                  key={dev.deviceId || i}
                  className={`wcf-cam-opt${dev.deviceId === selectedId ? ' wcf-cam-opt--active' : ''}`}
                  onClick={() => switchCamera(dev.deviceId)}
                  title={dev.label}
                >
                  <span className="wcf-cam-opt-idx">#{i + 1}</span>
                  <span className="wcf-cam-opt-lbl">{dev.label}</span>
                  {dev.deviceId === selectedId && camActive && (
                    <span className="wcf-cam-opt-live">●</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
