import { useEffect, useRef, useState, useCallback } from 'react'

const W = 320, H = 240   // native capture size
const DISPLAY_W = 300, DISPLAY_H = 225  // CSS display

// ── Draw green targeting reticle over a detected face bounding box ────────────
function drawReticle(ctx, box, scaleX = 1, scaleY = 1) {
  const x = box.x * scaleX
  const y = box.y * scaleY
  const w = box.width  * scaleX
  const h = box.height * scaleY
  const p = 6   // padding
  const b = 18  // bracket length

  ctx.save()
  ctx.strokeStyle = '#00FF41'
  ctx.lineWidth   = 1.8
  ctx.shadowColor = '#00FF41'
  ctx.shadowBlur  = 10

  const lx = x - p, rx = x + w + p
  const ty = y - p, by = y + h + p

  // Corner brackets
  ;[
    [[lx + b, ty],  [lx, ty],  [lx, ty + b]],
    [[rx - b, ty],  [rx, ty],  [rx, ty + b]],
    [[lx + b, by],  [lx, by],  [lx, by - b]],
    [[rx - b, by],  [rx, by],  [rx, by - b]],
  ].forEach(pts => {
    ctx.beginPath()
    pts.forEach(([px, py], i) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py))
    ctx.stroke()
  })

  // Center crosshair
  const cx = x + w / 2, cy = y + h / 2
  ctx.beginPath()
  ctx.moveTo(cx - 14, cy); ctx.lineTo(cx - 4, cy)
  ctx.moveTo(cx + 4,  cy); ctx.lineTo(cx + 14, cy)
  ctx.moveTo(cx, cy - 14); ctx.lineTo(cx, cy - 4)
  ctx.moveTo(cx, cy + 4);  ctx.lineTo(cx, cy + 14)
  ctx.stroke()

  // Dashed bounding ellipse
  ctx.setLineDash([4, 5])
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(cx, cy, w / 2 + p, h / 2 + p, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  // Label
  ctx.fillStyle = '#00FF41'
  ctx.shadowBlur = 6
  ctx.font = 'bold 9px "Courier New"'
  ctx.fillText('TARGET_ACQUIRED', lx, ty - 8)

  ctx.restore()
}

// ── Draw "no face" scanning bar ───────────────────────────────────────────────
function drawScanBar(ctx, ts) {
  const y = ((ts / 2200) % 1) * H
  ctx.save()
  const grad = ctx.createLinearGradient(0, y - 16, 0, y + 16)
  grad.addColorStop(0,   'rgba(0,255,65,0)')
  grad.addColorStop(0.5, 'rgba(0,255,65,0.18)')
  grad.addColorStop(1,   'rgba(0,255,65,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, y - 16, W, 32)
  ctx.strokeStyle = 'rgba(0,255,65,0.35)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, y); ctx.lineTo(W, y)
  ctx.stroke()
  ctx.restore()
}

export default function WebcamFeed() {
  const canvasRef  = useRef(null)
  const videoRef   = useRef(null)
  const rafRef     = useRef(null)
  const detectorRef= useRef(null)
  const faceBoxRef = useRef(null)  // last known bounding box

  const [minimized,  setMinimized]  = useState(false)
  const [camActive,  setCamActive]  = useState(false)
  const [camError,   setCamError]   = useState(null)
  const [faceFound,  setFaceFound]  = useState(false)

  // ── Init FaceDetector ──────────────────────────────────────────────────────
  useEffect(() => {
    if ('FaceDetector' in window) {
      try {
        detectorRef.current = new window.FaceDetector({ maxDetectedFaces: 1, fastMode: true })
      } catch (_) { /* unavailable */ }
    }
  }, [])

  // ── Start webcam ──────────────────────────────────────────────────────────
  const startCam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: W, height: H, facingMode: 'user' },
        audio: false,
      })
      const video = document.createElement('video')
      video.srcObject = stream
      video.playsInline = true
      video.muted = true
      await video.play()
      videoRef.current = video
      setCamActive(true)
      setCamError(null)
    } catch (err) {
      setCamError(err.message ?? 'CAMERA_DENIED')
    }
  }, [])

  // ── Face detection — throttled ─────────────────────────────────────────────
  const lastDetectRef = useRef(0)
  const detectFace = useCallback(async (video) => {
    if (!detectorRef.current) return
    const now = performance.now()
    if (now - lastDetectRef.current < 180) return   // ~5fps detection
    lastDetectRef.current = now
    try {
      const faces = await detectorRef.current.detect(video)
      if (faces.length > 0) {
        faceBoxRef.current = faces[0].boundingBox
        setFaceFound(true)
      } else {
        faceBoxRef.current = null
        setFaceFound(false)
      }
    } catch (_) {}
  }, [])

  // ── Render loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width  = W
    canvas.height = H

    const draw = () => {
      const ts = Date.now()
      const video = videoRef.current

      if (video && video.readyState >= 2) {
        // Mirror flip for selfie-cam feel
        ctx.save()
        ctx.translate(W, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(video, 0, 0, W, H)
        ctx.restore()

        // Green tint overlay
        ctx.fillStyle = 'rgba(0, 20, 8, 0.28)'
        ctx.fillRect(0, 0, W, H)

        // Face detection (async, non-blocking)
        detectFace(video)

        // Draw reticle or scan bar
        if (faceBoxRef.current) {
          // video is mirrored — mirror the box X coordinate
          const mirroredBox = {
            x:      W - faceBoxRef.current.x - faceBoxRef.current.width,
            y:      faceBoxRef.current.y,
            width:  faceBoxRef.current.width,
            height: faceBoxRef.current.height,
          }
          drawReticle(ctx, mirroredBox)
        } else {
          drawScanBar(ctx, ts)
          ctx.fillStyle = 'rgba(0,255,65,0.5)'
          ctx.font = 'bold 9px "Courier New"'
          ctx.fillText('SCANNING_BIOLOGICALS...', 8, H - 28)
        }

      } else {
        // No camera — dark noise grain
        const imageData = ctx.createImageData(W, H)
        const data = imageData.data
        for (let i = 0; i < data.length; i += 4) {
          const luma = (Math.random() * 255 * 0.22) | 0
          data[i]   = (luma * 0.18) | 0
          data[i+1] = (luma * 0.60) | 0
          data[i+2] = (luma * 0.15) | 0
          data[i+3] = 255
        }
        ctx.putImageData(imageData, 0, 0)
        drawScanBar(ctx, ts)
      }

      // CRT roll band
      const band = (ts / 160) % H
      ctx.fillStyle = 'rgba(0,255,80,0.035)'
      ctx.fillRect(0, band, W, 5)

      // Timestamp watermark
      ctx.fillStyle = 'rgba(255,107,0,0.5)'
      ctx.font = 'bold 9px "Courier New"'
      ctx.fillText(new Date().toISOString().replace('T', '  ').slice(0, 22), 6, H - 8)

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [detectFace])

  return (
    <div className="wcf-container">
      <div className="wcf-header">
        <span className={`wcf-dot${camActive ? '' : ' wcf-dot--off'}`} />
        EXT.&nbsp;BIO&nbsp;SUPERVISOR
        <div className="wcf-header-actions">
          {!camActive && (
            <button className="wcf-cam-btn" onClick={startCam} title="Enable camera">
              CAM
            </button>
          )}
          <button
            className="wcf-toggle"
            onClick={() => setMinimized(m => !m)}
            aria-label="Toggle feed"
          >
            {minimized ? '▲' : '▼'}
          </button>
        </div>
      </div>

      <div className="wcf-body" style={{ display: minimized ? 'none' : 'block' }}>
        {camError && (
          <div className="wcf-error">
            ACCESS_DENIED // {camError}
          </div>
        )}

        <div className="wcf-canvas-wrap">
          <canvas ref={canvasRef} className="wcf-canvas" />

          {/* SVG reticle layer — absolute overlay */}
          <svg className="wcf-reticle-svg" viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
            {/* Static corner frame markers */}
            {[
              `M4,18 L4,4 L18,4`,
              `M${W-18},4 L${W-4},4 L${W-4},18`,
              `M4,${H-18} L4,${H-4} L18,${H-4}`,
              `M${W-18},${H-4} L${W-4},${H-4} L${W-4},${H-18}`,
            ].map((d, i) => (
              <path key={i} d={d} fill="none" stroke="rgba(0,255,65,0.4)" strokeWidth="1.5" />
            ))}
            {/* Status text */}
            <text
              x={W / 2} y="14"
              textAnchor="middle"
              fill={faceFound ? '#00FF41' : 'rgba(0,255,65,0.4)'}
              fontSize="8"
              fontFamily="'Courier New',monospace"
              letterSpacing="1"
            >
              {faceFound ? 'FACE_LOCKED' : camActive ? 'AWAITING_FACE' : 'CAM_OFFLINE'}
            </text>
          </svg>
        </div>
      </div>
    </div>
  )
}
