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

// ── Glitch log messages ────────────────────────────────────────────────────────
const LOGS = {
  motion:   '[!] Stop moving! You are breaking the pixels.',
  face:     '[!] Weird energy detected from your face.',
  noMotion: '[?] Are you a statue? Checking for life.',
  lost:     '[LOST] Subject gone. Sector is lonely.',
}

// Log priority — higher number wins when competing
const LOG_PRI = { noMotion: 1, motion: 2, face: 3, lost: 4 }

// ── TTS — robotic female voice ────────────────────────────────────────────────
function speak(text) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
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
  if (window.speechSynthesis.getVoices().length) { doSpeak() }
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
  return raw
    .replace(/\(built[- ]?in\)/i, '(INT)').replace(/USB\s*/i, 'USB-')
    .replace(/\bcamera\b/i, 'CAM').replace(/\bwebcam\b/i, 'WEB').replace(/\bintegrated\b/i, 'INT')
    .trim().toUpperCase().slice(0, 20)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function WebcamFeed() {
  const { triggerBioAlert } = useApp()

  const canvasRef          = useRef(null)
  const videoRef           = useRef(null)
  const streamRef          = useRef(null)
  const rafRef             = useRef(null)
  const faceapiRef         = useRef(null)
  const detectingRef       = useRef(false)
  const detectInterRef     = useRef(null)
  const offscreenRef       = useRef(null)   // small canvas for motion sampling
  const prevFrameRef       = useRef(null)   // Uint8ClampedArray — reused to avoid GC churn
  const humanGlitchRef     = useRef(0)      // smooth float 0-100, read in rAF
  const speechCoolRef      = useRef(0)      // ms timestamp of last speech
  const lastLogKeyRef      = useRef(null)   // key of last fired log
  const lastMotionTsRef    = useRef(0)      // ms timestamp of last detected motion
  const faceWasHereRef     = useRef(false)  // previous frame had a face
  const faceOnSinceRef     = useRef(0)      // ms timestamp when face first appeared this run
  const soundOnRef         = useRef(false)
  const triggerRef         = useRef(triggerBioAlert)

  const [minimized,    setMinimized]    = useState(false)
  const [camActive,    setCamActive]    = useState(false)
  const [camError,     setCamError]     = useState(null)
  const [modelStatus,  setModelStatus]  = useState('idle')
  const [faceDetected, setFaceDetected] = useState(false)
  const [faceBox,      setFaceBox]      = useState(null)
  const [devices,      setDevices]      = useState([])
  const [selectedId,   setSelectedId]   = useState(null)
  const [switching,    setSwitching]    = useState(false)
  const [humanGlitch,  setHumanGlitch]  = useState(0)   // 0-100 integer for display
  const [logMessage,   setLogMessage]   = useState(null)
  const [soundOn,      setSoundOn]      = useState(false)

  useEffect(() => { triggerRef.current = triggerBioAlert }, [triggerBioAlert])
  useEffect(() => { soundOnRef.current = soundOn },        [soundOn])

  // ── Load face-api models ───────────────────────────────────────────────────
  useEffect(() => {
    setModelStatus('loading')
    getFaceApi()
      .then(fa => { faceapiRef.current = fa; setModelStatus('ready') })
      .catch(() => setModelStatus('error'))
  }, [])

  // ── Enumerate video inputs ─────────────────────────────────────────────────
  const refreshDevices = useCallback(async () => {
    try {
      const all  = await navigator.mediaDevices.enumerateDevices()
      const vids = all.filter(d => d.kind === 'videoinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: fmtLabel(d.label, i) }))
      setDevices(vids)
      setSelectedId(prev => prev ?? (vids[0]?.deviceId || null))
    } catch (_) {}
  }, [])

  useEffect(() => {
    refreshDevices()
    const ml = navigator.mediaDevices
    ml?.addEventListener('devicechange', refreshDevices)
    return () => ml?.removeEventListener('devicechange', refreshDevices)
  }, [refreshDevices])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null; videoRef.current = null
  }, [])
  useEffect(() => () => stopStream(), [stopStream])

  const startCamWithId = useCallback(async (deviceId) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: CAM_W }, height: { ideal: CAM_H }, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) },
      audio: false,
    })
    streamRef.current = stream
    const vid = document.createElement('video')
    vid.srcObject = stream; vid.playsInline = true; vid.muted = true
    await vid.play()
    videoRef.current = vid
    // Small offscreen canvas for fast motion sampling (80×45 ≈ 3600 px)
    const oc = document.createElement('canvas')
    oc.width = 80; oc.height = 45
    offscreenRef.current = oc
    prevFrameRef.current = null
    lastMotionTsRef.current = Date.now()   // prevent immediate "are you a statue"
  }, [])

  const startCam = useCallback(async () => {
    try {
      await startCamWithId(selectedId); setCamActive(true); setCamError(null); refreshDevices()
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

  // ── Log state machine ──────────────────────────────────────────────────────
  // Priority: lost > face > motion > noMotion
  // Lower-priority keys are suppressed if a higher-priority one fired recently
  const updateLog = useCallback((key) => {
    const now  = performance.now()
    const newP = LOG_PRI[key]     ?? 0
    const curP = LOG_PRI[lastLogKeyRef.current] ?? 0
    const age  = now - speechCoolRef.current

    // Block lower-priority updates for 5s after a higher-priority one
    if (newP < curP && age < 5000) return
    // Block same key repeat within 6s
    if (key === lastLogKeyRef.current && age < 6000) return

    lastLogKeyRef.current = key
    speechCoolRef.current = now
    setLogMessage(LOGS[key])
    if (soundOnRef.current) speak(LOGS[key])
    if (key !== 'noMotion') triggerRef.current()
  }, [])

  // ── Face detection loop — ~3 fps ──────────────────────────────────────────
  useEffect(() => {
    if (modelStatus !== 'ready' || !camActive) return
    const faceapi = faceapiRef.current

    const detect = async () => {
      const vid = videoRef.current
      if (!vid || vid.readyState < 2 || detectingRef.current) return
      detectingRef.current = true
      try {
        const dets = await faceapi
          .detectAllFaces(vid, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 }))
          .withFaceExpressions()

        const found = dets.length > 0

        // Subject just disappeared
        if (!found && faceWasHereRef.current) {
          setFaceDetected(false); setFaceBox(null)
          updateLog('lost')
        } else if (found) {
          // Track when face first appeared
          if (!faceWasHereRef.current) faceOnSinceRef.current = Date.now()

          const res = dets[0]
          const vW  = vid.videoWidth  || CAM_W
          const vH  = vid.videoHeight || CAM_H
          const sX  = W / vW, sY = H / vH
          const box = res.detection.box
          setFaceDetected(true)
          setFaceBox({
            x:      (vW - box.x - box.width) * sX,
            y:      box.y * sY,
            width:  box.width  * sX,
            height: box.height * sY,
          })

          // Smile = "weird energy"
          if ((res.expressions.happy ?? 0) > 0.50) updateLog('face')
        } else {
          setFaceDetected(false); setFaceBox(null)
        }
        faceWasHereRef.current = found
      } catch (_) {}
      finally { detectingRef.current = false }
    }

    detectInterRef.current = setInterval(detect, 333)
    return () => clearInterval(detectInterRef.current)
  }, [modelStatus, camActive, updateLog])

  // ── Canvas + motion render loop ────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = W; canvas.height = H

    const draw = () => {
      const ts  = Date.now()
      const vid = videoRef.current

      if (vid && vid.readyState >= 2) {
        // Mirror-flip the video (selfie view)
        ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1)
        ctx.drawImage(vid, 0, 0, W, H); ctx.restore()
        ctx.fillStyle = 'rgba(0,14,4,0.36)'; ctx.fillRect(0, 0, W, H)

        // ── Motion detection via pixel diff on small offscreen canvas ──────
        const oc = offscreenRef.current
        if (oc) {
          const oc2d = oc.getContext('2d')
          oc2d.drawImage(vid, 0, 0, 80, 45)
          const curr = oc2d.getImageData(0, 0, 80, 45).data

          if (prevFrameRef.current) {
            const prev = prevFrameRef.current
            let diff = 0
            // Sample every 4th pixel (step 16 bytes in RGBA) for speed
            for (let i = 0; i < curr.length; i += 16)
              diff += Math.abs(curr[i] - prev[i]) + Math.abs(curr[i+1] - prev[i+1]) + Math.abs(curr[i+2] - prev[i+2])
            const score = Math.min(100, (diff / (curr.length / 16)) * 3.5)

            if (score > 14) {
              lastMotionTsRef.current = ts
              humanGlitchRef.current = Math.min(100, humanGlitchRef.current + score * 0.35)
              updateLog('motion')
            } else {
              // Gradual decay when still
              humanGlitchRef.current = Math.max(0, humanGlitchRef.current - 1.0)
              // "Are you a statue?" — face visible, no motion for 4.5s, face around for 3s+
              if (
                faceWasHereRef.current &&
                ts - lastMotionTsRef.current > 4500 &&
                ts - faceOnSinceRef.current  > 3000
              ) {
                updateLog('noMotion')
              }
            }
            // Reuse buffer (avoid GC allocation every frame)
            prev.set(curr)
          } else {
            prevFrameRef.current = new Uint8ClampedArray(curr)
          }
        }

        setHumanGlitch(Math.round(humanGlitchRef.current))
      } else {
        drawNoise(ctx); drawScanBar(ctx, ts)
        humanGlitchRef.current = Math.max(0, humanGlitchRef.current - 0.5)
        setHumanGlitch(Math.round(humanGlitchRef.current))
      }

      // Subtle scan line band
      const band = (ts / 160) % H
      ctx.fillStyle = 'rgba(0,255,80,0.022)'; ctx.fillRect(0, band, W, 5)
      // Timestamp
      ctx.fillStyle = 'rgba(255,107,0,0.45)'; ctx.font = 'bold 9px "Courier New"'
      ctx.fillText(new Date().toISOString().replace('T', '  ').slice(0, 22), 5, H - 5)

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [updateLog])

  // ── Derived SVG values ────────────────────────────────────────────────────
  const realityStability = 100 - humanGlitch
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
  const fcx = faceBox ? faceBox.x + faceBox.width  / 2 : 0
  const fcy = faceBox ? faceBox.y + faceBox.height / 2 : 0
  const showSelector = devices.length > 1

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
          <canvas ref={canvasRef} className="wcf-canvas wcf-canvas--nv" />

          {/* ── HUD Bars — overlaid on the video ── */}
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
                    className={`wcf-hud-fill wcf-hud-fill--reality${realityStability < 30 ? ' wcf-hud-fill--critical' : ''}`}
                    style={{ width: `${realityStability}%` }}
                  />
                </div>
                <span className="wcf-hud-pct">{realityStability}%</span>
              </div>
            </div>
          )}

          {/* ── SVG reticle overlay ── */}
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

        {/* ── Glitch log display ── */}
        {camActive && logMessage && (
          <div className="wcf-glitch-log">
            <span className="wcf-glitch-log-cursor">▶</span>
            <span className="wcf-glitch-log-text">{logMessage}</span>
          </div>
        )}

        {/* ── Camera input selector (shown when 2+ devices detected) ── */}
        {showSelector && (
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
