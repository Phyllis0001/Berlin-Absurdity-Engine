import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'

// ─── Event pool ────────────────────────────────────────────────────────────────
// Each entry: sensor fn(v) → compact key:value string  |  action fn(v) → AI response
const EVENTS = [
  {
    sev: 'normal', label: 'KINETIC_ANOMALY',
    sensor: v => `VEL:${(v*0.003+0.12).toFixed(3)}m/s  MASS:${v+48}kg  KE:${(v*0.0004+0.022).toFixed(4)}J  ACCEL:${(v*0.001+0.003).toFixed(4)}m/s²`,
    action: () => `RECLASSIFY → VELOCITY_STRATIFIED_ZONE`,
  },
  {
    sev: 'normal', label: 'AERIAL_ACOUSTIC_EVENT',
    sensor: v => `ACOUSTIC:${(v*0.3+62).toFixed(1)}dB  FREQ:${v+180}Hz  HARMONICS:${(v*0.02).toFixed(3)}kHz`,
    action: v => `DISPATCH → COUNTER-AERIAL_UNIT  BRIEF:EATING_BREAD`,
  },
  {
    sev: 'normal', label: 'BIOLOGICAL_DEBRIS',
    sensor: v => `DRAG:${(v*0.0002+0.0001).toFixed(5)}N  TERM_V:${(v*0.001+0.012).toFixed(4)}m/s  MASS:${(v*0.001+0.003).toFixed(4)}kg`,
    action: () => `FILE → CEASE_DESIST_TO_TREE  CC:THE_WIND`,
  },
  {
    sev: 'warn', label: 'EM_GRID_ANOMALY',
    sensor: v => `FREQ:433.${v}MHz  SNR:${(v*0.07+1.2).toFixed(2)}dB  RSSI:-${v+44}dBm  BER:${(v*0.001).toFixed(4)}`,
    action: () => `ROUTE → PIGEON_NETWORK  BW:0.003Mbps  ENC:NONE`,
  },
  {
    sev: 'warn', label: 'UPLINK_DEGRADATION',
    sensor: v => `PKT_LOSS:${(v*0.03).toFixed(2)}%  RTT:${v*3+14}ms  JITTER:${(v*0.4+1.2).toFixed(1)}ms`,
    action: () => `DEPLOY → DANCE_OFFICER  PROFICIENCY:UNKNOWN`,
  },
  {
    sev: 'normal', label: 'MICRO_TECTONIC_EVENT',
    sensor: v => `VIBR:${(v*0.0003+0.0001).toFixed(5)}Hz  AMP:${(v*0.002+0.001).toFixed(4)}mm  MAG:${(v*0.002).toFixed(4)}`,
    action: () => `FILE → NEWTON_I.(DECEASED)  ETA:RETROACTIVELY_IMPOSSIBLE`,
  },
  {
    sev: 'normal', label: 'RIVER_VARIANCE',
    sensor: v => `FLOW:${(v*0.4+12.3).toFixed(1)}m³/s  TURB:${(v*0.01+0.03).toFixed(4)}  SAL:0.0${v}ppt`,
    action: () => `DECLARE → RIVER_LEGALLY_VOID  ORD:§47-AQUA`,
  },
  {
    sev: 'warn', label: 'THERMAL_EXCESS',
    sensor: v => `TEMP:${(v*0.1+36.2).toFixed(1)}°C  HUM:${v+45}%  P:${(1013+v*0.1).toFixed(1)}hPa`,
    action: () => `ZOOM_OUT → 0.0001x  STATUS:NEGLIGIBLE`,
  },
  {
    sev: 'normal', label: 'SOLAR_IRRADIANCE_SPIKE',
    sensor: v => `UV:${(v*0.3+2.1).toFixed(1)}  IRRAD:${v+800}W/m²  ALB:0.${v+30}  SPF_REC:${v*5+15}`,
    action: () => `RECLASSIFY → MANDATORY_HEATSCAPE`,
  },
  {
    sev: 'normal', label: 'COGNITIVE_OVERFLOW',
    sensor: v => `CPU:${v+38}%  MEM:${v+512}MB  JUNC:${v+62}°C  PID:0x${(v*0xFA1B).toString(16).toUpperCase().slice(-4)}`,
    action: () => `ACTIVATE → BOREDOM_COUNTERMEASURE  RISK:RECURSIVE`,
  },
  {
    sev: 'critical', label: 'UNREGISTERED_ENTITY',
    sensor: v => `SPECTRAL:${(v*0.3+4.4).toFixed(1)}GHz  MASS:${v+62}kg  VEL:${(v*0.05+0.8).toFixed(2)}m/s  PHASE:∅`,
    action: () => `DEPLOY → IKEA_MANUAL  LANG:WRONG  SAFETY:ASPIRATIONAL`,
  },
  {
    sev: 'warn', label: 'COGNITIVE_INTERFERENCE',
    sensor: v => `DISTRACT:${(v*0.02+0.08).toFixed(3)}T  FOCUS_IDX:-${v+3}  BW:${(v*0.1+0.2).toFixed(2)}Hz`,
    action: () => `DEPLOY → LARGER_DISTRACTION  LOOP:DETECTED`,
  },
  {
    sev: 'critical', label: 'THERMAL_EVENT',
    sensor: v => `COMB_T:${v+580}°C  CO₂:${v+420}ppm  SPREAD:${(v*0.04+0.2).toFixed(2)}m/s`,
    action: () => `DEPLOY → DIGITAL_WATER(NON_WET)  FIRE:UNCHANGED`,
  },
  {
    sev: 'critical', label: 'VEHICULAR_ENTROPY_EVENT',
    sensor: v => `IMPACT:${(v*0.8+2.1).toFixed(1)}kN  ΔV:${(v*0.4+8.2).toFixed(1)}km/h  DEBRIS:${v+3}m`,
    action: () => `RECLASSIFY → AUTOMOTIVE_SCULPTURE  VAL:+400%`,
  },
  {
    sev: 'warn', label: 'COLLECTIVE_MOBILITY_FAILURE',
    sensor: v => `DENSITY:${v+8}veh/100m  AVG_V:${(v*0.3+0.8).toFixed(1)}km/h  ENTROPY:MAX`,
    action: () => `ROADS:LEGALLY_VOID  PAMPHLETS:DEPLOYED`,
  },
  {
    sev: 'normal', label: 'GRAVITATIONAL_COMPLIANCE_INC',
    sensor: v => `ACCEL:9.81m/s²  Δ:${(v*0.001+0.0002).toFixed(4)}m/s²  IMPACT_E:${(v*0.3+1.2).toFixed(2)}J`,
    action: () => `FILE → GRAVITY_DEPT  NATURE:UNAUTHORIZED_ACCEL`,
  },
  {
    sev: 'normal', label: 'AMBIENT_NOISE_VIOLATION',
    sensor: v => `SPL:${(v*0.5+48).toFixed(1)}dB  PEAK_FREQ:${v*12+440}Hz  DURATION:${v+3}s`,
    action: () => `ISSUE → MUNICIPAL_SILENCE_ORDER  ETA:GEOLOGICAL`,
  },
  {
    sev: 'warn', label: 'STRUCTURAL_DISRUPTION_PROTOCOL',
    sensor: v => `VIBR_CONST:${(v*0.002+0.014).toFixed(4)}  DUST:${(v*0.3+18).toFixed(1)}μg/m³  NOISE:${v+72}dB`,
    action: v => `RECLASSIFY → PROGRESSIVE_CHAOS_INSTALLATION`,
  },
  {
    sev: 'normal', label: 'PEDESTRIAN_DENSITY_EVENT',
    sensor: v => `NODES:${v+3}  FLOW:${(v*0.04+0.8).toFixed(2)}p/s  CLUSTER_R:${(v*0.3+2.1).toFixed(1)}m`,
    action: () => `ARCHIVE → BIOMASS_LOG  RESOLUTION:NONE`,
  },
]

// ─── Weather-specific events ───────────────────────────────────────────────────
const WEATHER_EVENTS = {
  rain: {
    sev: 'warn', label: 'UNAUTHORIZED_PRECIPITATION',
    sensor: v => `PRECIP:${(v*0.4+1.2).toFixed(1)}mm/h  DROP_Ø:${(v*0.02+1.8).toFixed(2)}mm  KE:${(v*0.0001+0.0004).toFixed(5)}J`,
    action: () => `RECLASSIFY → TEMPORARY_PUBLIC_ART`,
  },
  snowing: {
    sev: 'warn', label: 'ICE_FORMATION_DETECTED',
    sensor: v => `SNOW:${(v*0.2+0.5).toFixed(1)}cm/h  CRYSTALS:${((v*1200+8000)|0)}/m³  ICE_RISK:HIGH`,
    action: () => `FILE → GRAVITY_NON_COMPLIANT  ORD:§ICE-4`,
  },
  storming: {
    sev: 'critical', label: 'ATMOSPHERIC_DISCHARGE',
    sensor: v => `VOLT:${v+40}kV  CURR:${v+8}kA  BOLT_Δ:${v+2}km  FLUX:${(v*0.3+1.2).toFixed(2)}Wb`,
    action: () => `RECLASSIFY → UNAUTHORIZED_ATMOSPHERIC_ART`,
  },
  heatwave: {
    sev: 'critical', label: 'THERMAL_GRID_EXCESS',
    sensor: v => `ASPHALT:${v+58}°C  AIR:${v+38}°C  MELT_IDX:${(v*0.02+0.8).toFixed(2)}`,
    action: () => `REMOVE → SOLAR_CONSTANT  ETA:8min`,
  },
  foggy: {
    sev: 'warn', label: 'VISIBILITY_COMPROMISE',
    sensor: v => `VIS:${v+80}m  PART:${(v*0.3+18).toFixed(1)}μg/m³  OPQ:${v+70}%`,
    action: () => `ISSUE → MANDATORY_FOG_PAMPHLETS`,
  },
  hail: {
    sev: 'critical', label: 'HAIL_PROTOCOL_ACTIVE',
    sensor: v => `HAIL_Ø:${v+5}mm  FORCE:${(v*0.02+0.18).toFixed(3)}N  DENSITY:${v+3}/m²`,
    action: () => `RECLASSIFY → GEOLOGICAL_SCULPTURE`,
  },
  cloudy: {
    sev: 'normal', label: 'NIMBUS_FORMATION',
    sensor: v => `COVER:${v+60}%  ALT:${(v*20+800)|0}m  OPT_DEPTH:${(v*0.02+0.4).toFixed(2)}`,
    action: v => `ARCHIVE → CLOUD_LOG  REF:§CLD-${v}`,
  },
  sunny: {
    sev: 'normal', label: 'SOLAR_ANOMALY',
    sensor: v => `UV:${(v*0.3+3.2).toFixed(1)}  IRRAD:${v+820}W/m²  T_Δ:+${(v*0.1+1.2).toFixed(1)}°C`,
    action: () => `RECLASSIFY → MANDATORY_WELLNESS_DISTRICT`,
  },
}

// ─── Entry factory ────────────────────────────────────────────────────────────
let _cnt = 0
function mkEntry(v, weather) {
  const useWeather = weather?.id && WEATHER_EVENTS[weather.id] && Math.random() < 0.30
  const tmpl = useWeather ? WEATHER_EVENTS[weather.id] : EVENTS[v % EVENTS.length]
  return {
    id:          ++_cnt,
    ts:          new Date().toTimeString().slice(0, 8),
    label:       tmpl.label,
    sensor:      tmpl.sensor(v),
    action:      tmpl.action(v),
    sev:         tmpl.sev,
    typedSensor: 0,
    typedAction: 0,
    done:        false,
  }
}

// Safe last-index-of helper (avoids findLastIndex browser compat concern)
function lastUndoneIdx(arr) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!arr[i].done) return i
  }
  return -1
}

const TICK_MS    = 22   // typing interval
const CHARS_TICK = 2    // chars revealed per tick  (~91 chars/sec)
const MAX_ROWS   = 60

// ─── Component ────────────────────────────────────────────────────────────────
export default function LogicFeed() {
  const { weather, season } = useApp()
  const [entries, setEntries] = useState([])
  const bottomRef  = useRef(null)
  const iterRef    = useRef(0)

  // ── Spawn new entries ──────────────────────────────────────────────────────
  useEffect(() => {
    const spawn = () => {
      iterRef.current++
      const v = (iterRef.current * 7 + Date.now()) % 97
      const e = mkEntry(v, weather)
      setEntries(prev => {
        // Immediately complete whatever row was still typing
        const completed = prev.map(x =>
          x.done ? x : { ...x, done: true, typedSensor: x.sensor.length, typedAction: x.action.length }
        )
        const next = [...completed, e]
        return next.length > MAX_ROWS ? next.slice(-MAX_ROWS) : next
      })
    }
    spawn()
    const iv = setInterval(spawn, 650 + Math.random() * 1300)
    return () => clearInterval(iv)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather?.id, season?.id])

  // ── Typing loop — always active ────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      setEntries(prev => {
        const idx = lastUndoneIdx(prev)
        if (idx === -1) return prev
        const e = prev[idx]
        let { typedSensor, typedAction, done } = e

        if (typedSensor < e.sensor.length) {
          typedSensor = Math.min(typedSensor + CHARS_TICK, e.sensor.length)
        } else if (typedAction < e.action.length) {
          typedAction = Math.min(typedAction + CHARS_TICK, e.action.length)
        } else {
          done = true
        }
        const updated = [...prev]
        updated[idx] = { ...e, typedSensor, typedAction, done }
        return updated
      })
    }, TICK_MS)
    return () => clearInterval(iv)
  }, [])

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [entries.length])

  return (
    <div className="sg-console">
      {/* Header */}
      <div className="sg-header">
        <span className="sg-dot" />
        SENSOR_GAZE&nbsp;//&nbsp;BERLIN_TACTICAL_GRID
        <span className="sg-hz">3.2Hz</span>
      </div>

      {/* Column labels */}
      <div className="sg-col-labels">
        <span>TIMESTAMP</span>
        <span>RAW_SENSOR_INPUT</span>
        <span>AI_ACTION</span>
      </div>
      <div className="sg-col-rule" />

      {/* Rows */}
      <div className="sg-body">
        {entries.map(e => {
          const sensorShow = e.sensor.slice(0, e.typedSensor)
          const actionShow = e.action.slice(0, e.typedAction)
          const typingCol  = !e.done && e.typedSensor < e.sensor.length ? 'sensor'
                           : !e.done && e.typedAction < e.action.length ? 'action'
                           : null
          return (
            <div key={e.id} className={`sg-row sg-row--${e.sev}`}>
              <span className="sg-ts">{e.ts}</span>

              <span className="sg-sensor-cell">
                <span className="sg-evt-label">[{e.label}]</span>
                <br />
                <span className="sg-raw">{sensorShow}</span>
                {typingCol === 'sensor' && <span className="sg-cursor">█</span>}
              </span>

              <span className="sg-action-cell">
                {actionShow}
                {typingCol === 'action' && <span className="sg-cursor">█</span>}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
