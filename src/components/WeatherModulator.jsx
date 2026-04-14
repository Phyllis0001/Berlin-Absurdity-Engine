import { useApp, WEATHER_TYPES, SEASONS } from '../context/AppContext'

// ── Dial geometry ──────────────────────────────────────────────────────────
const CX = 100, CY = 100          // SVG center (200×200 viewBox)
const R_RING   = 78               // outer tick ring
const R_TICK_O = 74               // tick outer end
const R_TICK_I = 66               // tick inner end
const R_DOT    = 60               // selection dot
const R_LABEL  = 88               // label text
const R_NEEDLE = 52               // needle tip
const R_KNOB   = 20               // center knob radius

function polar(angleDeg, r) {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

// Compute a text-anchor based on which side of the circle the label falls
function textAnchor(angleDeg) {
  const a = ((angleDeg % 360) + 360) % 360
  if (a > 20 && a < 160) return 'middle'   // bottom
  if (a > 200 && a < 340) return 'middle'  // top
  if (a >= 160 && a <= 200) return 'middle'
  return a < 180 ? 'start' : 'end'
}

function labelOffset(angleDeg) {
  const a = ((angleDeg % 360) + 360) % 360
  // Push label dy upward if it's near the top, downward near bottom
  if (a > 20  && a < 160) return  5
  if (a > 200 && a < 340) return -3
  return 4
}

export default function WeatherModulator() {
  const { weatherIdx, seasonIdx, setWeather, setSeason } = useApp()

  const needleTip = polar(weatherIdx * 45, R_NEEDLE)

  return (
    <div className="wmod-panel">
      <div className="wmod-header">
        ◈&nbsp;ENV_MODULATOR&nbsp;//&nbsp;ATMO_CTRL
      </div>

      <div className="wmod-body">
        {/* ── SVG Dial ── */}
        <svg
          viewBox="0 0 200 200"
          width="190"
          height="190"
          className="wmod-dial-svg"
          style={{ display: 'block', margin: '0 auto' }}
        >
          <defs>
            <filter id="wmod-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="wmod-glow-sm" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Decorative rings */}
          <circle cx={CX} cy={CY} r={R_RING + 8} fill="none" stroke="rgba(255,107,0,0.10)" strokeWidth="1" />
          <circle cx={CX} cy={CY} r={R_RING - 2} fill="none" stroke="rgba(255,107,0,0.07)" strokeWidth="1" strokeDasharray="2 5" />
          <circle cx={CX} cy={CY} r={R_DOT - 12} fill="none" stroke="rgba(255,107,0,0.06)" strokeWidth="1" strokeDasharray="3 6" />

          {/* Per-weather-type markers */}
          {WEATHER_TYPES.map((w, i) => {
            const angle   = i * 45
            const outer   = polar(angle, R_TICK_O)
            const inner   = polar(angle, R_TICK_I)
            const dot     = polar(angle, R_DOT)
            const lp      = polar(angle, R_LABEL)
            const isActive = i === weatherIdx
            const anchor  = textAnchor(angle)
            const dy      = labelOffset(angle)

            return (
              <g
                key={w.id}
                onClick={() => setWeather(i)}
                style={{ cursor: 'pointer' }}
              >
                {/* Invisible wider hit zone */}
                <circle cx={lp.x} cy={lp.y} r={12} fill="transparent" />

                {/* Tick */}
                <line
                  x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                  stroke={isActive ? '#FF6B00' : 'rgba(255,107,0,0.3)'}
                  strokeWidth={isActive ? 2 : 1}
                  filter={isActive ? 'url(#wmod-glow-sm)' : undefined}
                />

                {/* Selection dot */}
                <circle
                  cx={dot.x} cy={dot.y}
                  r={isActive ? 4 : 2.5}
                  fill={isActive ? '#FF6B00' : 'rgba(255,107,0,0.35)'}
                  filter={isActive ? 'url(#wmod-glow-sm)' : undefined}
                />

                {/* Label */}
                <text
                  x={lp.x} y={lp.y + dy}
                  textAnchor={anchor}
                  fill={isActive ? '#FF6B00' : 'rgba(255,107,0,0.45)'}
                  fontSize={isActive ? '7.5' : '6.5'}
                  fontFamily="'Courier New', monospace"
                  fontWeight={isActive ? 'bold' : 'normal'}
                  letterSpacing="0.5"
                  filter={isActive ? 'url(#wmod-glow-sm)' : undefined}
                >
                  {w.label.toUpperCase()}
                </text>
              </g>
            )
          })}

          {/* Needle glow shadow */}
          <line
            x1={CX} y1={CY} x2={needleTip.x} y2={needleTip.y}
            stroke="rgba(255,107,0,0.2)"
            strokeWidth="7"
            strokeLinecap="round"
          />
          {/* Needle */}
          <line
            x1={CX} y1={CY} x2={needleTip.x} y2={needleTip.y}
            stroke="#FF6B00"
            strokeWidth="2"
            strokeLinecap="round"
            filter="url(#wmod-glow)"
          />

          {/* Center knob */}
          <circle cx={CX} cy={CY} r={R_KNOB} fill="rgba(6,6,18,0.97)" stroke="rgba(255,107,0,0.5)" strokeWidth="1.5" />
          <circle cx={CX} cy={CY} r={R_KNOB - 6} fill="none" stroke="rgba(255,107,0,0.18)" strokeWidth="1" strokeDasharray="3 4" />
          <text
            x={CX} y={CY - 3}
            textAnchor="middle"
            fill="rgba(255,107,0,0.6)"
            fontSize="6.5"
            fontFamily="'Courier New', monospace"
            letterSpacing="0.5"
          >
            ENV
          </text>
          <text
            x={CX} y={CY + 6}
            textAnchor="middle"
            fill="#FF6B00"
            fontSize="7.5"
            fontFamily="'Courier New', monospace"
            fontWeight="bold"
            letterSpacing="1"
          >
            {WEATHER_TYPES[weatherIdx].code}
          </text>
        </svg>

        {/* ── Active weather display ── */}
        <div className="wmod-active">
          <span className="wmod-active-icon">{WEATHER_TYPES[weatherIdx].icon}</span>
          <span className="wmod-active-name">{WEATHER_TYPES[weatherIdx].label.toUpperCase()}</span>
        </div>

        {/* ── Season selector ── */}
        <div className="wmod-season-wrap">
          <div className="wmod-season-label">SEASON&nbsp;//&nbsp;TEMPORAL_CYCLE</div>
          <div className="wmod-season-row">
            {SEASONS.map((s, i) => (
              <button
                key={s.id}
                className={`wmod-season-btn${i === seasonIdx ? ' wmod-season-btn--active' : ''}`}
                onClick={() => setSeason(i)}
              >
                {s.label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
