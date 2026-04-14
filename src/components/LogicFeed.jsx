import { useEffect, useRef, useState } from 'react'
import { useApp, WEATHER_TYPES, SEASONS } from '../context/AppContext'

const BASE_MSGS = [
  v => `[SYS] > sector_${v} anomaly — threat vector: NOMINAL`,
  v => `[NET] > uplink BERLIN-${v} — latency: ${v*3+14}ms`,
  v => `[BIO] > pedestrian density ${v} — cluster nodes: ${v+3}`,
  v => `[SIG] > freq 433.${v}MHz — signal-noise ratio: ${(v*0.07+1.2).toFixed(2)}dB`,
  v => `[GEO] > tectonic micro-shift — Δ${(v*0.0003).toFixed(4)}° N`,
  v => `[CPU] > process_${v.toString(16).padStart(4,'0')} — mem: ${v+38}MB`,
  v => `[CAM] > optical sensor #${v} — CRC: 0x${(v*0xFA1B).toString(16).toUpperCase()}`,
  v => `[TAC] > entity ${v} — classification: AMBIGUOUS`,
  v => `[ENV] > barometric pressure: ${(1013 + v * 0.1).toFixed(1)} hPa`,
  v => `[SYS] > café density — index: CRITICAL (${v+3} units/m²)`,
  v => `[NET] > node 0x${(v*0x3F7A).toString(16)} — packet_loss: ${(v*0.03).toFixed(2)}%`,
  v => `[BIO] > schnitzel threat index — level: ${['GUARDED','ELEVATED','HIGH'][v%3]}`,
  v => `[GEO] > river spree — flow: ${(v*0.4+12.3).toFixed(1)} m³/s`,
  v => `[SIG] > satellite ${v} — AES handshake OK`,
  v => `[TAC] > absurdity quotient — Δ${(v*0.23+0.5).toFixed(2)} standard deviations`,
  v => `[SYS] > grid_recalibration — epoch: ${Date.now()-v*1000}`,
  v => `[CPU] > thermal throttle — junction: ${v+62}°C`,
  v => `[ENV] > UV index: ${(v*0.3+2.1).toFixed(1)} — SPF recommendation: ${v*5+15}`,
]

const SEVERITY_MSGS = [
  v => `[!!] > ANOMALY — sector_${v} boundary breach`,
  v => `[!!] > SIGNAL_LOST — node ${v}`,
  v => `[!!] > UNAUTHORIZED entity on freq ${v+400}.00 MHz`,
]

const WEATHER_MSGS = {
  sunny:    v => `[ENV] > solar_irradiance: ${v+800} W/m² — albedo: 0.${v+30}`,
  cloudy:   v => `[ENV] > cloud_cover: ${v+60}% — nimbus formation: ACTIVE`,
  rain:     v => `[ENV] > precipitation: ${(v*0.4+1.2).toFixed(1)} mm/h — drainage: NOMINAL`,
  foggy:    v => `[ENV] > visibility: ${v+80}m — fog_index: SEVERE`,
  snowing:  v => `[ENV] > snowfall: ${(v*0.2+0.5).toFixed(1)} cm/h — ice_risk: HIGH`,
  hail:     v => `[!!] > hail_diameter: ${v+5}mm — impact_vector: DOWNWARD`,
  storming: v => `[!!] > lightning_strike — Δ${v+2}km — voltage: ${v+40}kV`,
  heatwave: v => `[!!] > thermal_excess — temp: ${v+38}°C — asphalt_state: SOFTENING`,
}

let _msgCounter = 0
function nextMsg(weather, season) {
  _msgCounter++
  const v = (_msgCounter * 7 + Date.now()) % 97
  const roll = Math.random()
  if (roll < 0.12) return SEVERITY_MSGS[_msgCounter % SEVERITY_MSGS.length](v)
  if (roll < 0.28 && WEATHER_MSGS[weather?.id]) return WEATHER_MSGS[weather.id](v)
  return BASE_MSGS[_msgCounter % BASE_MSGS.length](v)
}

const MAX_LINES = 80

export default function LogicFeed() {
  const { weather, season } = useApp()
  const [lines, setLines] = useState([])
  const bottomRef = useRef(null)

  useEffect(() => {
    const push = () => {
      const ts    = new Date().toISOString().slice(11, 23)
      const text  = nextMsg(weather, season)
      const isWarn = text.startsWith('[!!')
      setLines(prev => {
        const next = [...prev, { ts, text, warn: isWarn, id: _msgCounter }]
        return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next
      })
    }

    push() // immediate first entry
    const iv = setInterval(push, 380 + Math.random() * 900)
    return () => clearInterval(iv)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather?.id, season?.id])

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [lines.length])

  return (
    <div className="logic-feed">
      <div className="logic-feed-header">
        <span className="logic-feed-dot" />
        LOGIC FEED&nbsp;//&nbsp;CONSOLE_OUT
        <span className="logic-feed-hz">
          {(1000 / 380).toFixed(1)}Hz
        </span>
      </div>
      <div className="logic-feed-body">
        {lines.map(l => (
          <div
            key={l.id}
            className={`logic-feed-line${l.warn ? ' logic-feed-line--warn' : ''}`}
          >
            <span className="logic-feed-ts">{l.ts}</span>
            {' '}{l.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
