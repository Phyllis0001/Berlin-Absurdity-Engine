import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import { useApp } from '../context/AppContext'
import WebcamFeed       from './WebcamFeed'
import LogicFeed        from './LogicFeed'
import CoordTracker     from './CoordTracker'
import WeatherModulator from './WeatherModulator'
import WarningOverlay   from './WarningOverlay'
import WeatherEffect    from './WeatherEffect'
import ProblemPanel     from './ProblemPanel'
import AISolutionModal  from './AISolutionModal'
import MapMarkersEffect from './MapMarkersEffect'

// ─── Palette ──────────────────────────────────────────────────────────────────
const RADAR_GREY       = '#0D0F14'
const SIGNAL_WHITE     = '#C8CCD8'
const WATER_DARK       = '#080E1A'
const ROAD_COLOR       = '#C06000'

// ─── Zone colours (one per sector) ────────────────────────────────────────────
export const ZONE_COLORS = [
  '#00D4FF',  // Sector 01 – Cyan
  '#FF6B00',  // Sector 02 – Orange
  '#39FF14',  // Sector 03 – Neon Green
  '#FF00CC',  // Sector 04 – Magenta
  '#FFE000',  // Sector 05 – Yellow
]

// MapLibre match expression: feature id → zone colour
const zoneColorExpr = [
  'match', ['get', 'id'],
  1, ZONE_COLORS[0],
  2, ZONE_COLORS[1],
  3, ZONE_COLORS[2],
  4, ZONE_COLORS[3],
  5, ZONE_COLORS[4],
  '#FF6B00',
]

// ─── Zones ────────────────────────────────────────────────────────────────────
const ZONES = [
  { id:1, label:'SECTOR 01', sector:'NORTH BAND',   centroid:[13.405,52.5500], coords:[[13.340,52.540],[13.470,52.540],[13.470,52.560],[13.340,52.560],[13.340,52.540]] },
  { id:2, label:'SECTOR 02', sector:'MID-WEST',     centroid:[13.3615,52.5225],coords:[[13.340,52.505],[13.383,52.505],[13.383,52.540],[13.340,52.540],[13.340,52.505]] },
  { id:3, label:'SECTOR 03', sector:'MID-CENTER',   centroid:[13.405,52.5225], coords:[[13.383,52.505],[13.427,52.505],[13.427,52.540],[13.383,52.540],[13.383,52.505]] },
  { id:4, label:'SECTOR 04', sector:'MID-EAST',     centroid:[13.4485,52.5225],coords:[[13.427,52.505],[13.470,52.505],[13.470,52.540],[13.427,52.540],[13.427,52.505]] },
  { id:5, label:'SECTOR 05', sector:'SOUTH BAND',   centroid:[13.405,52.4975], coords:[[13.340,52.490],[13.470,52.490],[13.470,52.505],[13.340,52.505],[13.340,52.490]] },
]

const ZONE_GEOJSON = {
  type:'FeatureCollection',
  features: ZONES.map(z => ({
    type:'Feature', id:z.id,
    properties:{ id:z.id, name:z.label },
    geometry:{ type:'Polygon', coordinates:[z.coords] }
  })),
}

const LABEL_GEOJSON = {
  type:'FeatureCollection',
  features: ZONES.map(z => ({
    type:'Feature',
    properties:{ line1:z.label, line2:'MONITORING' },
    geometry:{ type:'Point', coordinates:z.centroid }
  })),
}

// ─── Weather → map CSS filter ─────────────────────────────────────────────────
const WEATHER_FILTER = {
  sunny:    'brightness(1.04) saturate(1.05)',
  cloudy:   'brightness(0.80) saturate(0.65)',
  rain:     'brightness(0.72) saturate(0.60) hue-rotate(190deg)',
  foggy:    'brightness(0.80) saturate(0.30) blur(0.4px)',
  snowing:  'brightness(0.82) saturate(0.35) hue-rotate(195deg)',
  hail:     'brightness(0.62) saturate(0.45) hue-rotate(200deg)',
  storming: 'brightness(0.52) saturate(0.40) contrast(1.18)',
  heatwave: 'brightness(1.08) saturate(1.25) hue-rotate(-12deg)',
}

const WEATHER_TINT = {
  sunny:    'rgba(255,200,80,0.05)',
  cloudy:   'rgba(40,40,60,0.20)',
  rain:     'rgba(0,30,90,0.28)',
  foggy:    'rgba(190,195,210,0.28)',
  snowing:  'rgba(100,120,200,0.14)',
  hail:     'rgba(20,40,110,0.32)',
  storming: 'rgba(0,0,40,0.45)',
  heatwave: 'rgba(90,20,0,0.18)',
}

// ─── Point-in-polygon (ray casting) ──────────────────────────────────────────
function pointInZone(lng, lat, zone) {
  const ring = zone.coords
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j]
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

// ─── Zone live-status helpers ─────────────────────────────────────────────────
const CRIT_SEVS  = new Set(['CRITICAL', 'OMEGA', 'EXISTENTIAL'])
const HIGH_SEVS  = new Set(['HIGH', 'CLASSIFIED', 'SEVERE'])
function zoneStatus(problems, zoneId) {
  const z = ZONES.find(z => z.id === zoneId)
  const zp = problems.filter(p => pointInZone(p.lng, p.lat, z))
  if (zp.length === 0) return { label: 'NOMINAL', sub: '0 incidents', color: 'rgba(100,160,100,0.7)' }
  const hasCrit = zp.some(p => CRIT_SEVS.has(p.severity))
  const hasHigh = zp.some(p => HIGH_SEVS.has(p.severity))
  if (hasCrit) return { label: 'CRITICAL', sub: `${zp.length} incident${zp.length > 1 ? 's' : ''}`, color: '#FF2200' }
  if (hasHigh) return { label: 'ELEVATED', sub: `${zp.length} incident${zp.length > 1 ? 's' : ''}`, color: '#FF6B00' }
  return { label: 'ACTIVE', sub: `${zp.length} incident${zp.length > 1 ? 's' : ''}`, color: '#FFE000' }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MapComponent() {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const rafRef       = useRef(null)
  const bearingRef   = useRef(-30)
  const pausedRef    = useRef(false)
  const hoveredId    = useRef(null)

  const { warning, weather, problems, bioAlert, soundEnabled, setSoundEnabled } = useApp()

  const [orbitActive, setOrbitActive] = useState(true)
  const [coords,      setCoords]      = useState({ lng: 13.405, lat: 52.520, zoom: 15, bearing: -30, pitch: 45 })
  const [mapReady,    setMapReady]    = useState(false)

  // Live zone status (recomputed on every problems change)
  const zoneStats = useMemo(() =>
    ZONES.map(z => ({ ...z, color: ZONE_COLORS[z.id - 1], ...zoneStatus(problems, z.id) })),
    [problems]
  )

  const syncCoords = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const c = map.getCenter()
    setCoords({ lng: c.lng, lat: c.lat, zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() })
  }, [])

  useEffect(() => {
    if (mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style:     'https://tiles.openfreemap.org/styles/liberty',
      center:    [13.405, 52.520],
      zoom:      15, pitch: 45, bearing: bearingRef.current,
      antialias: true,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')

    const orbit = () => {
      if (!pausedRef.current && mapRef.current) { bearingRef.current += 0.04; map.setBearing(bearingRef.current) }
      rafRef.current = requestAnimationFrame(orbit)
    }

    let resumeTimer = null
    let onZoneMove = null, onZoneLeave = null
    const pauseOrbit  = () => { pausedRef.current = true; clearTimeout(resumeTimer) }
    const resumeOrbit = () => { resumeTimer = setTimeout(() => { bearingRef.current = map.getBearing(); pausedRef.current = false }, 3000) }

    map.on('mousedown', pauseOrbit); map.on('touchstart', pauseOrbit); map.on('wheel', pauseOrbit)
    map.on('mouseup', resumeOrbit);  map.on('touchend', resumeOrbit)
    map.on('move', syncCoords)

    map.on('style.load', () => {
      const { layers } = map.getStyle()
      layers.forEach(layer => {
        try {
          const sl = layer['source-layer'] ?? ''
          const id = layer.id.toLowerCase()
          if (layer.type === 'background') {
            map.setPaintProperty(layer.id, 'background-color', RADAR_GREY)
          } else if (layer.type === 'fill') {
            if      (sl === 'water')    map.setPaintProperty(layer.id, 'fill-color', WATER_DARK)
            else if (sl === 'building') map.setLayoutProperty(layer.id, 'visibility', 'none')
            else {
              map.setPaintProperty(layer.id, 'fill-color', RADAR_GREY)
              try { map.setPaintProperty(layer.id, 'fill-outline-color', '#0A0C12') } catch (_) {}
            }
          } else if (layer.type === 'line') {
            const isRoad  = sl === 'transportation' || id.includes('road') || id.includes('highway') || id.includes('street') || id.includes('path')
            const isWater = sl === 'waterway' || sl === 'water'
            if      (isRoad)  { map.setPaintProperty(layer.id, 'line-color', ROAD_COLOR); try { map.setPaintProperty(layer.id, 'line-blur', 0.8) } catch (_) {} }
            else if (isWater) map.setPaintProperty(layer.id, 'line-color', WATER_DARK)
            else              map.setPaintProperty(layer.id, 'line-color', '#111420')
          } else if (layer.type === 'symbol') {
            try { map.setLayoutProperty(layer.id, 'visibility', 'none') } catch (_) {}
          }
        } catch (_) {}
      })

      // Road glow
      try {
        map.addLayer({ id:'road-glow', type:'line', source:'openmaptiles', 'source-layer':'transportation',
          paint:{ 'line-color': '#FF6B00', 'line-width':['interpolate',['linear'],['zoom'],12,4,16,10], 'line-blur':8, 'line-opacity':0.18 }
        })
      } catch (_) {}

      // 3D buildings
      map.addLayer({
        id:'3d-buildings', type:'fill-extrusion', source:'openmaptiles', 'source-layer':'building', minzoom:13,
        paint:{
          'fill-extrusion-color':   SIGNAL_WHITE,
          'fill-extrusion-height':  ['coalesce',['get','render_height'],['get','height'],0],
          'fill-extrusion-base':    ['coalesce',['get','render_min_height'],['get','min_height'],0],
          'fill-extrusion-opacity': 0.80,
        },
      })

      // ── Tactical zones with per-zone colour ──────────────────────────────
      map.addSource('tactical-zones', { type:'geojson', data:ZONE_GEOJSON, promoteId:'id' })

      map.addLayer({
        id:'zone-fill', type:'fill', source:'tactical-zones',
        paint:{
          'fill-color': zoneColorExpr,
          'fill-opacity': ['case', ['boolean',['feature-state','hover'],false], 0.18, 0.06],
        }
      })
      map.addLayer({
        id:'zone-glow', type:'line', source:'tactical-zones',
        paint:{ 'line-color': zoneColorExpr, 'line-width':10, 'line-blur':7, 'line-opacity':0.40 }
      })
      map.addLayer({
        id:'zone-border', type:'line', source:'tactical-zones',
        paint:{ 'line-color': zoneColorExpr, 'line-width':1.5, 'line-opacity':0.90 }
      })
      map.addLayer({
        id:'zone-hover-glow', type:'line', source:'tactical-zones',
        paint:{
          'line-color': zoneColorExpr,
          'line-width': 18, 'line-blur': 14,
          'line-opacity': ['case', ['boolean',['feature-state','hover'],false], 0.65, 0.0],
        }
      })

      // Sector labels
      map.addSource('sector-labels', { type:'geojson', data:LABEL_GEOJSON })
      map.addLayer({
        id:'sector-labels-text', type:'symbol', source:'sector-labels',
        layout:{
          'text-field': ['concat',['get','line1'],'\n',['get','line2']],
          'text-font': ['Noto Sans Bold','Open Sans Bold','Open Sans Regular'],
          'text-size': 12, 'text-letter-spacing': 0.1,
          'text-anchor': 'center', 'text-max-width': 8, 'text-allow-overlap': false,
        },
        paint:{ 'text-color': '#C8CCD8', 'text-halo-color': 'rgba(200,204,216,0.25)', 'text-halo-width': 2, 'text-opacity': 0.75 },
      })

      onZoneMove = (e) => {
        if (e.features.length > 0) {
          const newId = e.features[0].id
          if (hoveredId.current !== null && hoveredId.current !== newId)
            map.setFeatureState({ source:'tactical-zones', id:hoveredId.current }, { hover:false })
          hoveredId.current = newId
          map.setFeatureState({ source:'tactical-zones', id:newId }, { hover:true })
          map.getCanvas().style.cursor = 'crosshair'
        }
      }
      onZoneLeave = () => {
        if (hoveredId.current !== null)
          map.setFeatureState({ source:'tactical-zones', id:hoveredId.current }, { hover:false })
        hoveredId.current = null
        map.getCanvas().style.cursor = ''
      }
      map.on('mousemove',  'zone-fill', onZoneMove)
      map.on('mouseleave', 'zone-fill', onZoneLeave)

      rafRef.current = requestAnimationFrame(orbit)
      setMapReady(true)
    })

    return () => {
      cancelAnimationFrame(rafRef.current); clearTimeout(resumeTimer)
      map.off('mousedown',pauseOrbit); map.off('touchstart',pauseOrbit); map.off('wheel',pauseOrbit)
      map.off('mouseup',resumeOrbit);  map.off('touchend',resumeOrbit)
      map.off('move',syncCoords)
      if (onZoneMove)  map.off('mousemove',  'zone-fill', onZoneMove)
      if (onZoneLeave) map.off('mouseleave', 'zone-fill', onZoneLeave)
      map.remove(); mapRef.current = null
    }
  }, [syncCoords])

  const weatherId  = weather?.id ?? 'sunny'
  const mapFilter  = WEATHER_FILTER[weatherId] ?? ''
  const tintColor  = WEATHER_TINT[weatherId]   ?? 'transparent'

  return (
    <div
      className={`app-root${warning ? ' global-warning' : ''}${bioAlert ? ' bio-alert-active' : ''}`}
      style={{ width:'100vw', height:'100vh', position:'relative', background: RADAR_GREY }}
    >
      <div ref={containerRef} style={{ width:'100%', height:'100%', filter: mapFilter, transition:'filter 1.4s ease' }} />
      <div className="digital-grid" />
      <div className="weather-tint" style={{ background: tintColor, transition:'background 1.4s ease' }} />

      {/* ── Bio Alert: red flash overlay ── */}
      {bioAlert && <div className="bio-alert-flash" />}

      {/* ── Bio Alert: containment laser from webcam (bottom-right) to map center ── */}
      {bioAlert && (
        <svg className="containment-laser-svg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="laser-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Core beam */}
          <line
            className="laser-beam"
            x1="91%" y1="87%"
            x2="50%" y2="50%"
            filter="url(#laser-glow)"
          />
          {/* Bright center */}
          <line
            className="laser-beam laser-beam--core"
            x1="91%" y1="87%"
            x2="50%" y2="50%"
          />
          {/* Target reticle at map center */}
          <circle className="laser-target" cx="50%" cy="50%" r="18" />
          <circle className="laser-target laser-target--inner" cx="50%" cy="50%" r="6" />
          <line className="laser-crosshair" x1="calc(50% - 28px)" y1="50%" x2="calc(50% - 10px)" y2="50%" />
          <line className="laser-crosshair" x1="calc(50% + 10px)" y1="50%" x2="calc(50% + 28px)" y2="50%" />
          <line className="laser-crosshair" x1="50%" y1="calc(50% - 28px)" x2="50%" y2="calc(50% - 10px)" />
          <line className="laser-crosshair" x1="50%" y1="calc(50% + 10px)" x2="50%" y2="calc(50% + 28px)" />
        </svg>
      )}

      {/* ── Bio Alert: message banner ── */}
      {bioAlert && (
        <div className="bio-alert-banner">
          <span className="bio-alert-label">▶ SUBJECT 001: EMOTIONAL ANOMALY DETECTED</span>
          <span className="bio-alert-sub">CONTAINMENT LASER ENGAGED // PROTOCOL BIO-7 ACTIVE</span>
        </div>
      )}

      <WeatherEffect />
      {mapReady && <MapMarkersEffect mapRef={mapRef} />}

      {/* ── Title Bar ── */}
      <div className="title-bar">
        <span className="title-bar-blink">▮</span>
        BERLIN SENSOR MONITOR&nbsp;// SYSTEM_v0.1
        <span className="title-bar-blink">▮</span>
      </div>

      {/* ── Zone Status ── */}
      <div className="zs-overlay">
        <div className="zs-header"><span className="zs-icon">◈</span>ZONE&nbsp;STATUS<span className="zs-icon">◈</span></div>
        <div className="zs-divider" />
        {zoneStats.map(z => (
          <div key={z.id} className="zs-row">
            <div className="zs-name" style={{ color: z.color, textShadow: `0 0 8px ${z.color}88` }}>
              [{z.label}]
              <span className="zs-zone-dot" style={{ background: z.color, boxShadow: `0 0 6px ${z.color}` }} />
            </div>
            <div className="zs-sector">{z.sector}</div>
            <div className="zs-risk">
              Status:&nbsp;
              <span
                className={`zs-status${z.label !== 'NOMINAL' ? ' zs-status--alert' : ''}`}
                style={{ color: z.color, textShadow: `0 0 8px ${z.color}88` }}
              >
                {z.label}
              </span>
              &nbsp;/&nbsp;
              <span className="zs-sub">{z.sub}</span>
            </div>
          </div>
        ))}
        <div className="zs-divider" />
        <div className="zs-footer">SYS: BERLIN TACTICAL GRID&nbsp;v2.4 // LIVE</div>
      </div>

      <LogicFeed />
      <WeatherModulator />
      <CoordTracker coords={coords} />

      {/* ── Camera Controls ── */}
      <div className="cam-controls">
        <div className="cam-controls-header">◈&nbsp;CAM&nbsp;CONTROL</div>
        <button
          className={`cam-btn${orbitActive ? ' cam-btn--active' : ''}`}
          onClick={() => {
            const next = !orbitActive
            setOrbitActive(next); pausedRef.current = !next
            if (next) bearingRef.current = mapRef.current?.getBearing() ?? bearingRef.current
          }}
        >
          {orbitActive ? 'ORBIT: ON' : 'ORBIT: OFF'}
        </button>
        <button className="cam-btn" onClick={() => {
          if (!mapRef.current) return
          pausedRef.current = true; setOrbitActive(false)
          mapRef.current.easeTo({ pitch:45, zoom:15, bearing:0, center:[13.405,52.520], duration:800 })
          bearingRef.current = 0
        }}>RESET CAM</button>
        <div className="cam-controls-divider" />
        <button
          className={`cam-btn cam-btn--sound${soundEnabled ? ' cam-btn--active' : ''}`}
          onClick={() => setSoundEnabled(s => !s)}
          title={soundEnabled ? 'Disable AI audio narration' : 'Enable AI audio narration'}
        >
          {soundEnabled ? '◉ SND: ON' : '○ SND: OFF'}
        </button>
      </div>

      <WebcamFeed />
      <ProblemPanel />
      <AISolutionModal />
      <WarningOverlay />
    </div>
  )
}
