import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'

// ── Weather ────────────────────────────────────────────────────────────────────
export const WEATHER_TYPES = [
  { id: 'sunny',    label: 'Sunny',    icon: '☀',  code: 'SOL' },
  { id: 'cloudy',   label: 'Cloudy',   icon: '☁',  code: 'CLD' },
  { id: 'rain',     label: 'Rain',     icon: '🌧', code: 'RAN' },
  { id: 'foggy',    label: 'Foggy',    icon: '🌫', code: 'FOG' },
  { id: 'snowing',  label: 'Snowing',  icon: '❄',  code: 'SNW' },
  { id: 'hail',     label: 'Hail',     icon: '🌨', code: 'HAL' },
  { id: 'storming', label: 'Storming', icon: '⛈', code: 'STR' },
  { id: 'heatwave', label: 'Heatwave', icon: '🔥', code: 'HWT' },
]

export const SEASONS = [
  { id: 'spring', label: 'Spring', code: 'Q2' },
  { id: 'summer', label: 'Summer', code: 'Q3' },
  { id: 'autumn', label: 'Autumn', code: 'Q4' },
  { id: 'winter', label: 'Winter', code: 'Q1' },
]

// ── Problem types ──────────────────────────────────────────────────────────────
export const NORMAL_PROBLEMS = [
  { typeId: 'car_crash',      category: 'normal',   icon: '🚗', label: 'Car Crash',       aiLabel: 'VEHICULAR ENTROPY EVENT',         severity: 'HIGH'     },
  { typeId: 'traffic_jam',    category: 'normal',   icon: '🚦', label: 'Traffic Jam',     aiLabel: 'COLLECTIVE MOBILITY FAILURE',     severity: 'ELEVATED' },
  { typeId: 'fire',           category: 'normal',   icon: '🔥', label: 'Fire Accident',   aiLabel: 'UNAUTHORIZED THERMAL EXPANSION',  severity: 'CRITICAL' },
  { typeId: 'fall',           category: 'normal',   icon: '⚠',  label: 'Fall',            aiLabel: 'GRAVITY COMPLIANCE INCIDENT',     severity: 'LOW'      },
  { typeId: 'construction',   category: 'normal',   icon: '🏗', label: 'Construction',    aiLabel: 'STRUCTURAL DISRUPTION PROTOCOL',  severity: 'MEDIUM'   },
  { typeId: 'signal_damage',  category: 'normal',   icon: '📡', label: 'Signal Damage',   aiLabel: 'EM GRID COMPROMISE',              severity: 'HIGH'     },
]

export const NONSENSE_PROBLEMS = [
  { typeId: 'leaf_fall',      category: 'nonsense', icon: '🍃', label: 'Leaf Fall',       aiLabel: 'CRITICAL BIOLOGICAL DEBRIS',                    severity: 'OMEGA'       },
  { typeId: 'bird_threat',    category: 'nonsense', icon: '🐦', label: 'Bird Threat',     aiLabel: 'UNAUTHORIZED AERIAL SURVEILLANCE UNIT',         severity: 'CLASSIFIED'  },
  { typeId: 'distraction',    category: 'nonsense', icon: '💭', label: 'Distraction',     aiLabel: 'COGNITIVE FREQUENCY INTERFERENCE',              severity: 'SEVERE'      },
  { typeId: 'slow_walker',    category: 'nonsense', icon: '🚶', label: 'Slow Walker',     aiLabel: 'KINETIC LOGISTICAL ANOMALY',                    severity: 'CRITICAL'    },
  { typeId: 'ghost',          category: 'nonsense', icon: '👻', label: 'Ghost',           aiLabel: 'UNREGISTERED METAPHYSICAL ENTITY',              severity: 'EXISTENTIAL' },
]

export const ALL_PROBLEMS = [...NORMAL_PROBLEMS, ...NONSENSE_PROBLEMS]

// ── AI "solutions" (exaggeration pools per type) ───────────────────────────────
export const AI_SOLUTIONS = {
  car_crash: [
    "RECLASSIFYING crash site as avant-garde automotive sculpture. Filing with Berlin Art Board. Physical danger: UNCHANGED. Cultural value: +400%.",
    "DEPLOYING 847 virtual cones (non-physical). Dispatching Newton-complaint form to gravity. Expected resolution: ∞.",
    "SOLUTION: Car crash was caused by gravity. COUNTERMEASURE: Removing gravity from affected 50m² zone. Side effects: everything else also floating.",
  ],
  traffic_jam: [
    "SOLUTION: Declare all affected roads legally non-existent. Traffic cannot block roads that do not legally exist. Problem: DISSOLVED by ordinance.",
    "RECLASSIFYING jam as 'collective stationary commute experience.' Distributing mindfulness pamphlets to 847 vehicles. Estimated reading time: 3 hours.",
    "AI CALCULATES optimal honking frequency to disperse jam: exactly 0.0 Hz. Deploying certified silence. ETA: geological.",
  ],
  fire: [
    "DEPLOYING digital water (non-wet, simulation-only). Fire status: UNCHANGED but now aesthetically certified. Insurance claim: pending.",
    "RECLASSIFYING fire as 'unauthorized thermal art installation.' Issuing cease-and-desist to flames. Legal status: pending since flames cannot read.",
    "INITIATING Protocol FIRE-9: zooming map out until fire is statistically negligible. Zoom level required: 0.0001. Problem: VISUALLY RESOLVED.",
  ],
  fall: [
    "ANALYSIS: Subject experienced unsolicited gravitational acceleration event. FILING formal complaint with Isaac Newton (deceased). ETA: retroactively impossible.",
    "DEPLOYING holographic padding city-wide. Budget: €12 billion. Completion: never. Interim measure: blame the pavement.",
    "GRAVITY CONFIRMED HOSTILE. Reclassifying pavement as 'aggressive surface entity.' Issuing territorial dispute with Planet Earth. Response time: 4.5 billion years.",
  ],
  construction: [
    "RECLASSIFYING zone as 'progressive chaos installation.' Noise reclassified as 'mandatory ambient soundscape.' Earplugs: optional, billed separately.",
    "DEPLOYING noise-cancelling declaration (paper-based, font size 6). All residents required to enjoy construction. Compliance: mandatory. Enforcement: symbolic.",
    "OPTIMAL detour calculated. Result: detour passes through 7 additional construction zones. DEPLOYING hope protocol. Estimated hope level: LOW.",
  ],
  signal_damage: [
    "BACKUP relay initiated via carrier pigeon network (47 units). Bandwidth: 0.003 Mbps. Latency: weather-dependent. Encryption: none. Status: DEPLOYED.",
    "RECLASSIFYING zone as 'intentional electromagnetic silence corridor.' Rebranding as digital wellness area. Compensation: vibes only.",
    "TRAFFIC MANAGEMENT via interpretive dance officer. Dispatched. Dance proficiency: unknown. Uniform: regular clothes. Safety: aspirational.",
  ],
  leaf_fall: [
    "DEPLOYING 400 virtual containment walls around leaf trajectory. Each wall: semi-permeable to wind. Actual containment: philosophical. Leaf status: STILL FALLING.",
    "ISSUING formal cease-and-desist to the tree. Carbon copies sent to: The Wind, Autumn Incorporated, and Deciduous Biology Department. Expected response: spring.",
    "RECLASSIFYING falling leaf as 'unauthorized biological projectile.' Tagging for criminal prosecution. Case #GRN-00001. Bail set at: one acorn. Leaf attorney: branch.",
  ],
  bird_threat: [
    "DISPATCHING counter-aerial unit (model: also a bird). Mission briefing: look suspicious. Current status: distracted by bread crumbs on Alexanderplatz.",
    "INITIATING diplomatic communication in standard chirp protocol. Response received: 'chirp.' Classification: CLASSIFIED. Escalating to NATO. NATO response: 'chirp.'",
    "DEPLOYING anti-surveillance camouflage: a hat. Effectiveness against bird: 0.4%. Stylishness rating: HIGH. Problem: FASHIONABLY UNRESOLVED.",
  ],
  distraction: [
    "DEPLOYING LARGER distraction to overwrite original distraction. STATUS: new distraction is distracted by original distraction. RECURSIVE LOOP DETECTED. System stability: -12%.",
    "RECLASSIFYING distraction as 'cognitive bandwidth reallocation event.' Issuing mandatory focus tokens (non-binding). Compliance rate: 0.07%.",
    "ACTIVATING boredom countermeasure: generating activity MORE boring than current distraction. Risk: subject now distracted by boredom of the countermeasure.",
  ],
  slow_walker: [
    "KINETIC ANOMALY ADDRESSED: sidewalk reclassified as 'velocity-stratified zone.' Slow walker is now officially in the correct zone. Problem: RECLASSIFIED as feature.",
    "DEPLOYING motivational hologram 47m ahead reading 'You're almost there.' Walker's pace: unchanged. Walker's morale: unknown. Hologram cost: €4,200.",
    "CALCULATING optimal shouting vector... RESULT: any shouting reduces speed further. Deploying patience protocol. Estimated resolution: geological timescale.",
  ],
  ghost: [
    "ECTOPLASMIC SCAN: entity confirmed on metaphysical freq 4.7 GHz. COUNTERMEASURE: deploying 800 pages of Berlin municipal paperwork. Historical effectiveness against supernatural: 100%.",
    "ISSUING metaphysical parking ticket: €340 fine for unlicensed haunting. Applicable under ordinance §47b (spectral entities, 2019). Payment method: ectoplasm accepted.",
    "GHOST CONTAINMENT: deploying IKEA furniture assembly manual (wrong language). All entities — corporeal or otherwise — rendered temporarily helpless. Safety not guaranteed.",
  ],
}

// ── Berlin spawn bounds (keep near visible area at default zoom) ───────────────
const SPAWN = { minLng: 13.355, maxLng: 13.455, minLat: 52.500, maxLat: 52.540 }

function randSpawnLocation() {
  return {
    lng: SPAWN.minLng + Math.random() * (SPAWN.maxLng - SPAWN.minLng),
    lat: SPAWN.minLat + Math.random() * (SPAWN.maxLat - SPAWN.minLat),
  }
}

function getAISolution(typeId) {
  const pool = AI_SOLUTIONS[typeId] ?? ['SOLUTION CLASSIFIED. Deploying protocol UNKNOWN. ETA: undefined.']
  return pool[Math.floor(Math.random() * pool.length)]
}

// ── Context ────────────────────────────────────────────────────────────────────
const AppCtx = createContext(null)

export function AppProvider({ children }) {
  const [weatherIdx,  setWeatherIdx]  = useState(0)
  const [seasonIdx,   setSeasonIdx]   = useState(1)
  const [warning,     setWarning]     = useState(null)
  const [problems,    setProblems]    = useState([])
  const [selectedId,  setSelectedId]  = useState(null)   // problem whose AI solution is shown
  const warnTimer  = useRef(null)
  const spawnTimer = useRef(null)

  // ── Warning ──────────────────────────────────────────────────────────────
  const triggerWarning = useCallback((msg, severity = 'INFO') => {
    clearTimeout(warnTimer.current)
    setWarning({ msg, severity, ts: Date.now() })
    warnTimer.current = setTimeout(() => setWarning(null), 4500)
  }, [])

  const setWeather = useCallback((idx) => {
    setWeatherIdx(idx)
    triggerWarning(
      `ATMOSPHERIC SHIFT // ENV_CODE: ${WEATHER_TYPES[idx].code} // ${WEATHER_TYPES[idx].label.toUpperCase()}`,
      'WEATHER',
    )
  }, [triggerWarning])

  const setSeason = useCallback((idx) => {
    setSeasonIdx(idx)
    triggerWarning(
      `TEMPORAL_CYCLE CHANGE // SEASON: ${SEASONS[idx].label.toUpperCase()} // GRID_RECALIBRATING`,
      'SEASON',
    )
  }, [triggerWarning])

  // ── Problems ─────────────────────────────────────────────────────────────
  const spawnProblem = useCallback((typeDefOrId) => {
    const typeDef = typeof typeDefOrId === 'string'
      ? ALL_PROBLEMS.find(p => p.typeId === typeDefOrId)
      : typeDefOrId
    if (!typeDef) return
    const { lng, lat } = randSpawnLocation()
    const id = `prob_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    setProblems(prev => {
      // cap at 10 simultaneous
      const trimmed = prev.length >= 10 ? prev.slice(1) : prev
      return [...trimmed, { ...typeDef, id, lng, lat, spawnedAt: Date.now(), aiActive: false, aiSolution: null }]
    })
  }, [])

  const removeProblem = useCallback((id) => {
    setProblems(prev => prev.filter(p => p.id !== id))
    setSelectedId(prev => prev === id ? null : prev)
  }, [])

  const selectProblem = useCallback((id) => {
    setSelectedId(prev => prev === id ? null : id)
    // If not yet AI-engaged, activate now
    setProblems(prev => prev.map(p =>
      p.id === id && !p.aiActive
        ? { ...p, aiActive: true, aiSolution: getAISolution(p.typeId) }
        : p
    ))
  }, [])

  // ── Auto-spawn loop ───────────────────────────────────────────────────────
  useEffect(() => {
    const schedule = () => {
      const delay = 8000 + Math.random() * 10000  // 8-18s between spawns
      spawnTimer.current = setTimeout(() => {
        const pool = ALL_PROBLEMS
        spawnProblem(pool[Math.floor(Math.random() * pool.length)])
        schedule()
      }, delay)
    }
    // First spawn after 3s
    spawnTimer.current = setTimeout(() => { spawnProblem(ALL_PROBLEMS[0]); schedule() }, 3000)
    return () => clearTimeout(spawnTimer.current)
  }, [spawnProblem])

  // ── Problem expiry (45s) ──────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now()
      setProblems(prev => prev.filter(p => now - p.spawnedAt < 45000))
    }, 5000)
    return () => clearInterval(iv)
  }, [])

  const selectedProblem = problems.find(p => p.id === selectedId) ?? null

  return (
    <AppCtx.Provider value={{
      weatherIdx, seasonIdx, warning,
      weather: WEATHER_TYPES[weatherIdx],
      season:  SEASONS[seasonIdx],
      setWeather, setSeason,
      problems, spawnProblem, removeProblem, selectProblem,
      selectedProblem, selectedId,
    }}>
      {children}
    </AppCtx.Provider>
  )
}

export const useApp = () => useContext(AppCtx)
