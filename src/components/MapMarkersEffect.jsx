import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useApp } from '../context/AppContext'

// ─── Geometry helpers ─────────────────────────────────────────────────────────
function circlePolygon(lng, lat, radiusM, steps = 48) {
  const latR  = lat * Math.PI / 180
  const dLng  = radiusM / (111320 * Math.cos(latR))
  const dLat  = radiusM / 111320
  const coords = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)])
  }
  return { type:'Feature', geometry:{ type:'Polygon', coordinates:[coords] } }
}

function ringPolygon(lng, lat, outerM, innerM, steps = 48) {
  const latR   = lat * Math.PI / 180
  const dLngO  = outerM / (111320 * Math.cos(latR)); const dLatO = outerM / 111320
  const dLngI  = innerM / (111320 * Math.cos(latR)); const dLatI = innerM / 111320
  const outer  = [], inner = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    outer.push([lng + dLngO * Math.cos(a), lat + dLatO * Math.sin(a)])
    inner.push([lng + dLngI * Math.cos(a), lat + dLatI * Math.sin(a)])
  }
  return { type:'Feature', geometry:{ type:'Polygon', coordinates:[outer, inner.reverse()] } }
}

function boxFeature(lng, lat, wM, hM) {
  const latR = lat * Math.PI / 180
  const w = wM / (111320 * Math.cos(latR))
  const h = hM / 111320
  const r = [[lng-w,lat-h],[lng+w,lat-h],[lng+w,lat+h],[lng-w,lat+h],[lng-w,lat-h]]
  return { type:'Feature', geometry:{ type:'Polygon', coordinates:[r] } }
}

function gridLines(lng, lat, halfWm, halfHm, stepM) {
  const latR = lat * Math.PI / 180
  const sx = stepM / (111320 * Math.cos(latR))
  const sy = stepM / 111320
  const hw = halfWm / (111320 * Math.cos(latR))
  const hh = halfHm / 111320
  const features = []
  for (let x = lng - hw; x <= lng + hw + sx * 0.01; x += sx)
    features.push({ type:'Feature', geometry:{ type:'LineString', coordinates:[[x, lat - hh],[x, lat + hh]] } })
  for (let y = lat - hh; y <= lat + hh + sy * 0.01; y += sy)
    features.push({ type:'Feature', geometry:{ type:'LineString', coordinates:[[lng - hw, y],[lng + hw, y]] } })
  return { type:'FeatureCollection', features }
}

function trackingLines(lng, lat) {
  const offsets = [[0.0012,0.0007],[-0.0015,-0.0005],[0.0004,-0.0013],[-0.0008,0.0014],[0.0016,-0.0003],[-0.0006,-0.0016]]
  return {
    type:'FeatureCollection',
    features: offsets.map(([dx,dy]) => ({
      type:'Feature',
      geometry:{ type:'LineString', coordinates:[[lng+dx, lat+dy],[lng,lat]] }
    }))
  }
}

// ─── HTML Marker builders ─────────────────────────────────────────────────────
function reticleHTML(p, color) {
  return `
<div class="pmk pmk--${p.typeId}">
  <div class="pmk-reticle-wrap">
    <svg class="pmk-svg pmk-svg--spin-slow" viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r="28" fill="none" stroke="${color}" stroke-width="1.2" stroke-dasharray="5 3" opacity="0.8"/>
      <circle cx="32" cy="32" r="18" fill="none" stroke="${color}" stroke-width="0.7" opacity="0.45"/>
      <line x1="2"  y1="32" x2="18" y2="32" stroke="${color}" stroke-width="1.5"/>
      <line x1="46" y1="32" x2="62" y2="32" stroke="${color}" stroke-width="1.5"/>
      <line x1="32" y1="2"  x2="32" y2="18" stroke="${color}" stroke-width="1.5"/>
      <line x1="32" y1="46" x2="32" y2="62" stroke="${color}" stroke-width="1.5"/>
      <circle cx="32" cy="32" r="3" fill="${color}" opacity="0.9"/>
      <path d="M6,14 L6,6 L14,6"   fill="none" stroke="${color}" stroke-width="1.5"/>
      <path d="M50,6 L58,6 L58,14" fill="none" stroke="${color}" stroke-width="1.5"/>
      <path d="M6,50 L6,58 L14,58" fill="none" stroke="${color}" stroke-width="1.5"/>
      <path d="M58,50 L58,58 L50,58" fill="none" stroke="${color}" stroke-width="1.5"/>
    </svg>
    <div class="pmk-icon">${p.icon}</div>
  </div>
  <div class="pmk-label" style="border-color:${color}44;box-shadow:0 0 8px ${color}33">
    <span class="pmk-text" style="color:${color};text-shadow:0 0 6px ${color}88">${p.aiLabel}</span>
  </div>
</div>`
}

function biohazardHTML(p) {
  return `
<div class="pmk pmk--${p.typeId}">
  <div class="pmk-reticle-wrap">
    <svg class="pmk-svg pmk-svg--spin" viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r="28" fill="none" stroke="#39FF14" stroke-width="2" stroke-dasharray="6 2" opacity="0.9"/>
      <circle cx="32" cy="32" r="20" fill="none" stroke="#39FF14" stroke-width="1" opacity="0.5"/>
      <!-- Biohazard arcs -->
      <path d="M32,14 A18,18 0 0,1 46.6,23" fill="none" stroke="#39FF14" stroke-width="3"/>
      <path d="M46.6,41 A18,18 0 0,1 17.4,41" fill="none" stroke="#39FF14" stroke-width="3"/>
      <path d="M17.4,23 A18,18 0 0,1 32,14"  fill="none" stroke="#39FF14" stroke-width="3"/>
      <circle cx="32" cy="32" r="4" fill="#39FF14" opacity="0.8"/>
      <circle cx="32" cy="14" r="3" fill="#39FF14" opacity="0.7"/>
      <circle cx="46.6" cy="41" r="3" fill="#39FF14" opacity="0.7"/>
      <circle cx="17.4" cy="41" r="3" fill="#39FF14" opacity="0.7"/>
    </svg>
    <div class="pmk-icon">${p.icon}</div>
  </div>
  <div class="pmk-label pmk-label--nonsense">
    <span class="pmk-text pmk-text--bio">ORGANIC DEBRIS DETECTED // STERILIZATION INITIATED</span>
  </div>
</div>`
}

function ghostHTML(p) {
  return `
<div class="pmk pmk--ghost pmk--glitch">
  <div class="pmk-reticle-wrap pmk-glitch-wrap">
    <div class="pmk-static-block"></div>
    <div class="pmk-icon pmk-icon--glitch">${p.icon}</div>
  </div>
  <div class="pmk-label pmk-label--ghost">
    <span class="pmk-text pmk-text--ghost">UNREGISTERED META-PHYSICAL ENTITY // FILING ASTRAL TRESPASS FINE</span>
  </div>
</div>`
}

function slowWalkerHTML(p) {
  return `
<div class="pmk pmk--slow_walker">
  <div class="pmk-reticle-wrap">
    <svg class="pmk-svg" viewBox="0 0 64 64" width="64" height="64">
      <!-- Kinetic inefficiency reticle -->
      <circle cx="32" cy="32" r="28" fill="none" stroke="#FF8800" stroke-width="1.5" stroke-dasharray="3 1" opacity="0.9"/>
      <circle cx="32" cy="32" r="20" fill="none" stroke="#FF8800" stroke-width="2" opacity="0.6"/>
      <circle cx="32" cy="32" r="10" fill="none" stroke="#FF4400" stroke-width="1" opacity="0.5"/>
      <!-- Speed arrows -->
      <path d="M24,28 L32,20 L40,28" fill="none" stroke="#FF4400" stroke-width="2" opacity="0.8"/>
      <path d="M24,34 L32,26 L40,34" fill="none" stroke="#FF6600" stroke-width="1.5" opacity="0.5"/>
      <line x1="32" y1="20" x2="32" y2="44" stroke="#FF8800" stroke-width="1" stroke-dasharray="2 2" opacity="0.6"/>
      <circle cx="32" cy="32" r="3" fill="#FF4400" opacity="0.9"/>
    </svg>
    <div class="pmk-icon pmk-icon--slow">${p.icon}</div>
  </div>
  <div class="pmk-label" style="border-color:#FF880044;box-shadow:0 0 8px #FF880033">
    <span class="pmk-text" style="color:#FF8800;text-shadow:0 0 6px #FF880088">KINETIC INEFFICIENCY // VIRTUAL SPEED-LANE DEPLOYING</span>
  </div>
</div>`
}

function birdHTML(p) {
  return `
<div class="pmk pmk--bird_threat">
  <div class="pmk-reticle-wrap">
    <svg class="pmk-svg pmk-svg--pulse" viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r="28" fill="none" stroke="#FF0044" stroke-width="1.5" opacity="0.9"/>
      <!-- Missile tracking cross -->
      <line x1="2"  y1="32" x2="62" y2="32" stroke="#FF0044" stroke-width="1" opacity="0.7"/>
      <line x1="32" y1="2"  x2="32" y2="62" stroke="#FF0044" stroke-width="1" opacity="0.7"/>
      <!-- Diamond target -->
      <polygon points="32,12 44,32 32,52 20,32" fill="none" stroke="#FF0044" stroke-width="1.5" opacity="0.6"/>
      <circle cx="32" cy="32" r="5" fill="none" stroke="#FF0044" stroke-width="2"/>
      <circle cx="32" cy="32" r="2" fill="#FF0044"/>
    </svg>
    <div class="pmk-icon">${p.icon}</div>
  </div>
  <div class="pmk-label pmk-label--bird">
    <span class="pmk-text" style="color:#FF0044;text-shadow:0 0 6px #FF004488">MISSILE_TRACKING LOCKED // AERIAL THREAT DESIGNATED</span>
  </div>
</div>`
}

function distractionHTML(p) {
  return `
<div class="pmk pmk--distraction pmk--confused">
  <div class="pmk-reticle-wrap">
    <svg class="pmk-svg pmk-svg--wobble" viewBox="0 0 64 64" width="64" height="64">
      <!-- Confused/erratic rings -->
      <circle cx="32" cy="32" r="26" fill="none" stroke="#CC00FF" stroke-width="1.5" stroke-dasharray="2 4 8 2" opacity="0.8"/>
      <circle cx="30" cy="33" r="16" fill="none" stroke="#FF00CC" stroke-width="1" opacity="0.5"/>
      <circle cx="34" cy="30" r="10" fill="none" stroke="#8800FF" stroke-width="1.5" opacity="0.4"/>
      <!-- Question marks as error signals -->
      <text x="26" y="20" font-size="8" fill="#CC00FF" opacity="0.7">?</text>
      <text x="42" y="36" font-size="7" fill="#FF00CC" opacity="0.6">?</text>
      <text x="18" y="44" font-size="9" fill="#8800FF" opacity="0.5">?</text>
      <circle cx="32" cy="32" r="3" fill="#CC00FF" opacity="0.8"/>
    </svg>
    <div class="pmk-icon">${p.icon}</div>
  </div>
  <div class="pmk-label pmk-label--distract">
    <span class="pmk-text" style="color:#CC00FF;text-shadow:0 0 6px #CC00FF88">AI_CONFUSED // COGNITIVE FREQUENCY INTERFERENCE DETECTED</span>
  </div>
</div>`
}

// ─── Color per problem type ───────────────────────────────────────────────────
const TYPE_COLOR = {
  fire:          '#FF2200',
  car_crash:     '#00FFFF',
  traffic_jam:   '#00FFFF',
  construction:  '#FFE000',
  signal_damage: '#FFE000',
  fall:          '#FF6B00',
  leaf_fall:     '#39FF14',
  bird_threat:   '#FF0044',
  slow_walker:   '#FF8800',
  ghost:         '#00FFAA',
  distraction:   '#CC00FF',
}

function markerHTML(p) {
  switch (p.typeId) {
    case 'leaf_fall':   return biohazardHTML(p)
    case 'ghost':       return ghostHTML(p)
    case 'slow_walker': return slowWalkerHTML(p)
    case 'bird_threat': return birdHTML(p)
    case 'distraction': return distractionHTML(p)
    default:            return reticleHTML(p, TYPE_COLOR[p.typeId] ?? '#FF6B00')
  }
}

// ─── Map layer builders ───────────────────────────────────────────────────────
function buildFireLayers(map, id, lng, lat) {
  const circle80 = circlePolygon(lng, lat, 80)

  map.addSource(`fi_cyl_${id}`, { type:'geojson', data:circle80 })
  // Oxygen-depletion cylinder (blue fill)
  map.addLayer({ id:`fi_cyl_fill_${id}`, type:'fill', source:`fi_cyl_${id}`,
    paint:{ 'fill-color':'#0044FF', 'fill-opacity':0.14 } })
  map.addLayer({ id:`fi_cyl_line_${id}`, type:'line', source:`fi_cyl_${id}`,
    paint:{ 'line-color':'#0088FF', 'line-width':2, 'line-opacity':0.7 } })

  // Pulsing buildings inside radius
  map.addLayer({
    id:`fi_bld_${id}`, type:'fill-extrusion',
    source:'openmaptiles', 'source-layer':'building',
    filter:['within', circle80],
    paint:{
      'fill-extrusion-color': '#FF2200',
      'fill-extrusion-height': ['coalesce',['get','render_height'],['get','height'],8],
      'fill-extrusion-base':   ['coalesce',['get','render_min_height'],['get','min_height'],0],
      'fill-extrusion-opacity': 0.85,
    }
  })

  const layers  = [`fi_cyl_fill_${id}`,`fi_cyl_line_${id}`,`fi_bld_${id}`]
  const sources = [`fi_cyl_${id}`]

  let t = 0
  const tick = () => {
    t += 0.05
    const r = Math.floor(200 + 55 * Math.abs(Math.sin(t)))
    const g = Math.floor(20 + 90 * Math.abs(Math.sin(t + 0.9)))
    try {
      map.setPaintProperty(`fi_bld_${id}`, 'fill-extrusion-color', `rgb(${r},${g},0)`)
      map.setPaintProperty(`fi_cyl_fill_${id}`, 'fill-opacity', 0.10 + 0.12 * Math.abs(Math.sin(t * 0.4)))
    } catch (_) {}
  }
  return { layers, sources, tick }
}

function buildCrashLayers(map, id, lng, lat, typeId) {
  const color = '#00FFFF'
  const grid  = gridLines(lng, lat, 60, 40, 20)
  const box   = boxFeature(lng, lat, 70, 50)

  map.addSource(`cr_grid_${id}`, { type:'geojson', data:grid })
  map.addSource(`cr_box_${id}`,  { type:'geojson', data:{ type:'FeatureCollection', features:[box] } })

  map.addLayer({ id:`cr_grid_l_${id}`, type:'line', source:`cr_grid_${id}`,
    paint:{ 'line-color':color, 'line-width':0.8, 'line-opacity':0.5 } })
  map.addLayer({ id:`cr_box_f_${id}`,  type:'fill', source:`cr_box_${id}`,
    paint:{ 'fill-color':color, 'fill-opacity':0.05 } })
  map.addLayer({ id:`cr_box_l_${id}`,  type:'line', source:`cr_box_${id}`,
    paint:{ 'line-color':color, 'line-width':2.5, 'line-opacity':0.9, 'line-dasharray':[4,2] } })

  const layers  = [`cr_grid_l_${id}`,`cr_box_f_${id}`,`cr_box_l_${id}`]
  const sources = [`cr_grid_${id}`,`cr_box_${id}`]

  let t = 0
  const tick = () => {
    t += 0.04
    const op = 0.3 + 0.6 * Math.abs(Math.sin(t * 0.7))
    try {
      map.setPaintProperty(`cr_box_l_${id}`, 'line-opacity', op)
      map.setPaintProperty(`cr_grid_l_${id}`, 'line-opacity', op * 0.55)
      map.setPaintProperty(`cr_box_f_${id}`,  'fill-opacity', 0.03 + 0.06 * Math.abs(Math.sin(t * 0.4)))
    } catch (_) {}
  }
  return { layers, sources, tick }
}

function buildConstructionLayers(map, id, lng, lat) {
  const area = boxFeature(lng, lat, 45, 45)
  const latR = lat * Math.PI / 180
  const mToDeg = 1 / (111320 * Math.cos(latR))
  // Hazard stripes — diagonal lines across the box
  const stripeFeatures = []
  for (let i = -4; i <= 4; i++) {
    const off = i * 0.0008
    stripeFeatures.push({
      type:'Feature',
      geometry:{ type:'LineString', coordinates:[[lng - mToDeg*45 + off, lat - 45/111320],[lng + mToDeg*45 + off, lat + 45/111320]] }
    })
  }

  map.addSource(`cn_area_${id}`, { type:'geojson', data:{ type:'FeatureCollection', features:[area] } })
  map.addSource(`cn_stripes_${id}`, { type:'geojson', data:{ type:'FeatureCollection', features:stripeFeatures } })

  map.addLayer({ id:`cn_fill_${id}`, type:'fill', source:`cn_area_${id}`,
    paint:{ 'fill-color':'#FFE000', 'fill-opacity':0.10 } })
  map.addLayer({ id:`cn_border_${id}`, type:'line', source:`cn_area_${id}`,
    paint:{ 'line-color':'#FFE000', 'line-width':2.5, 'line-opacity':0.9, 'line-dasharray':[6,3] } })
  map.addLayer({ id:`cn_stripes_l_${id}`, type:'line', source:`cn_stripes_${id}`,
    paint:{ 'line-color':'#FF8800', 'line-width':1, 'line-opacity':0.4 } })

  const layers  = [`cn_fill_${id}`,`cn_border_${id}`,`cn_stripes_l_${id}`]
  const sources = [`cn_area_${id}`,`cn_stripes_${id}`]

  let t = 0
  const tick = () => {
    t += 0.06
    try {
      map.setPaintProperty(`cn_fill_${id}`, 'fill-opacity', 0.06 + 0.10 * Math.abs(Math.sin(t * 0.5)))
      map.setPaintProperty(`cn_border_${id}`, 'line-opacity', 0.5 + 0.5 * Math.abs(Math.sin(t * 0.8)))
    } catch (_) {}
  }
  return { layers, sources, tick }
}

function buildFallLayers(map, id, lng, lat) {
  const c50  = circlePolygon(lng, lat, 50)
  const ring = ringPolygon(lng, lat, 52, 45)

  map.addSource(`fa_fill_${id}`, { type:'geojson', data:c50 })
  map.addSource(`fa_ring_${id}`, { type:'geojson', data:ring })

  map.addLayer({ id:`fa_area_${id}`, type:'fill', source:`fa_fill_${id}`,
    paint:{ 'fill-color':'#FF6B00', 'fill-opacity':0.12 } })
  map.addLayer({ id:`fa_border_${id}`, type:'line', source:`fa_fill_${id}`,
    paint:{ 'line-color':'#FF6B00', 'line-width':2, 'line-opacity':0.8, 'line-dasharray':[3,2] } })
  map.addLayer({ id:`fa_ring_${id}`, type:'fill', source:`fa_ring_${id}`,
    paint:{ 'fill-color':'#FF4400', 'fill-opacity':0.18 } })

  const layers  = [`fa_area_${id}`,`fa_border_${id}`,`fa_ring_${id}`]
  const sources = [`fa_fill_${id}`,`fa_ring_${id}`]

  let t = 0
  const tick = () => {
    t += 0.04
    try {
      map.setPaintProperty(`fa_area_${id}`, 'fill-opacity', 0.06 + 0.10 * Math.abs(Math.sin(t * 0.6)))
      map.setPaintProperty(`fa_border_${id}`, 'line-opacity', 0.4 + 0.6 * Math.abs(Math.sin(t)))
      map.setPaintProperty(`fa_ring_${id}`, 'fill-opacity', 0.08 + 0.16 * Math.abs(Math.sin(t * 1.3)))
    } catch (_) {}
  }
  return { layers, sources, tick }
}

function buildLeafLayers(map, id, lng, lat) {
  const outer = circlePolygon(lng, lat, 38)
  const ring  = ringPolygon(lng, lat, 40, 30)

  map.addSource(`lf_ring_${id}`, { type:'geojson', data:ring })
  map.addSource(`lf_outer_${id}`,{ type:'geojson', data:outer })

  map.addLayer({ id:`lf_ring_f_${id}`, type:'fill', source:`lf_ring_${id}`,
    paint:{ 'fill-color':'#39FF14', 'fill-opacity':0.20 } })
  map.addLayer({ id:`lf_border_${id}`, type:'line', source:`lf_outer_${id}`,
    paint:{ 'line-color':'#39FF14', 'line-width':3, 'line-opacity':0.9, 'line-dasharray':[2,1] } })

  const layers  = [`lf_ring_f_${id}`,`lf_border_${id}`]
  const sources = [`lf_ring_${id}`,`lf_outer_${id}`]

  let t = 0
  const tick = () => {
    t += 0.08
    try {
      map.setPaintProperty(`lf_ring_f_${id}`, 'fill-opacity', 0.10 + 0.18 * Math.abs(Math.sin(t * 0.7)))
      map.setPaintProperty(`lf_border_${id}`, 'line-opacity', 0.5 + 0.5 * Math.abs(Math.sin(t * 1.1)))
    } catch (_) {}
  }
  return { layers, sources, tick }
}

function buildBirdLayers(map, id, lng, lat) {
  const lines = trackingLines(lng, lat)
  const dot   = circlePolygon(lng, lat, 12)

  map.addSource(`bi_lines_${id}`, { type:'geojson', data:lines })
  map.addSource(`bi_dot_${id}`,   { type:'geojson', data:dot })

  map.addLayer({ id:`bi_lines_l_${id}`, type:'line', source:`bi_lines_${id}`,
    paint:{ 'line-color':'#FF0044', 'line-width':1.5, 'line-opacity':0.8, 'line-dasharray':[5,3] } })
  map.addLayer({ id:`bi_dot_f_${id}`, type:'fill', source:`bi_dot_${id}`,
    paint:{ 'fill-color':'#FF0044', 'fill-opacity':0.25 } })

  const layers  = [`bi_lines_l_${id}`,`bi_dot_f_${id}`]
  const sources = [`bi_lines_${id}`,`bi_dot_${id}`]

  let t = 0
  const tick = () => {
    t += 0.06
    try {
      map.setPaintProperty(`bi_lines_l_${id}`, 'line-opacity', 0.3 + 0.7 * Math.abs(Math.sin(t * 0.9)))
      map.setPaintProperty(`bi_dot_f_${id}`, 'fill-opacity', 0.10 + 0.25 * Math.abs(Math.sin(t * 1.5)))
    } catch (_) {}
  }
  return { layers, sources, tick }
}

function buildSlowWalkerLayers(map, id, lng, lat) {
  const lane = boxFeature(lng, lat, 8, 40)
  map.addSource(`sw_lane_${id}`, { type:'geojson', data:{ type:'FeatureCollection', features:[lane] } })
  map.addLayer({ id:`sw_fill_${id}`, type:'fill', source:`sw_lane_${id}`,
    paint:{ 'fill-color':'#FF8800', 'fill-opacity':0.15 } })
  map.addLayer({ id:`sw_line_${id}`, type:'line', source:`sw_lane_${id}`,
    paint:{ 'line-color':'#FF8800', 'line-width':2, 'line-opacity':0.8, 'line-dasharray':[4,2] } })

  const layers  = [`sw_fill_${id}`,`sw_line_${id}`]
  const sources = [`sw_lane_${id}`]

  let t = 0
  const tick = () => {
    t += 0.04
    try {
      map.setPaintProperty(`sw_fill_${id}`, 'fill-opacity', 0.05 + 0.20 * ((Math.sin(t * 0.5) + 1) / 2))
      map.setPaintProperty(`sw_line_${id}`, 'line-opacity', 0.4 + 0.5 * Math.abs(Math.sin(t * 0.8)))
    } catch (_) {}
  }
  return { layers, sources, tick }
}

function buildGhostLayers(map, id, lng, lat) {
  const circle = circlePolygon(lng, lat, 35)
  map.addSource(`gh_area_${id}`, { type:'geojson', data:circle })
  map.addLayer({ id:`gh_fill_${id}`, type:'fill', source:`gh_area_${id}`,
    paint:{ 'fill-color':'#00FFAA', 'fill-opacity':0.08 } })
  map.addLayer({ id:`gh_line_${id}`, type:'line', source:`gh_area_${id}`,
    paint:{ 'line-color':'#00FFAA', 'line-width':1.5, 'line-opacity':0.6, 'line-dasharray':[2,2] } })

  const layers  = [`gh_fill_${id}`,`gh_line_${id}`]
  const sources = [`gh_area_${id}`]

  let t = 0
  const tick = () => {
    t += 0.12
    // Erratic flicker
    const flicker = Math.random() < 0.15 ? 0 : 0.04 + 0.12 * Math.abs(Math.sin(t * 2.3))
    try {
      map.setPaintProperty(`gh_fill_${id}`, 'fill-opacity', flicker)
      map.setPaintProperty(`gh_line_${id}`, 'line-opacity', Math.random() < 0.15 ? 0 : 0.3 + 0.6 * Math.abs(Math.sin(t)))
    } catch (_) {}
  }
  return { layers, sources, tick }
}

function buildDistractionLayers(map, id, lng, lat) {
  const big = circlePolygon(lng, lat, 150)
  map.addSource(`di_area_${id}`, { type:'geojson', data:big })
  map.addLayer({ id:`di_fill_${id}`, type:'fill', source:`di_area_${id}`,
    paint:{ 'fill-color':'#CC00FF', 'fill-opacity':0.12 } })
  map.addLayer({ id:`di_line_${id}`, type:'line', source:`di_area_${id}`,
    paint:{ 'line-color':'#CC00FF', 'line-width':2, 'line-opacity':0.6, 'line-dasharray':[3,3] } })

  const layers  = [`di_fill_${id}`,`di_line_${id}`]
  const sources = [`di_area_${id}`]

  let t = 0
  const tick = () => {
    t += 0.03
    try {
      map.setPaintProperty(`di_fill_${id}`, 'fill-opacity', 0.06 + 0.14 * Math.abs(Math.sin(t * 0.4)))
      map.setPaintProperty(`di_line_${id}`, 'line-opacity', 0.3 + 0.5 * Math.abs(Math.sin(t * 0.6)))
    } catch (_) {}
  }
  return { layers, sources, tick }
}

// ─── Dispatch per typeId ──────────────────────────────────────────────────────
function buildLayersForProblem(map, p) {
  const { id, typeId, lng, lat } = p
  try {
    switch (typeId) {
      case 'fire':          return buildFireLayers(map, id, lng, lat)
      case 'car_crash':
      case 'traffic_jam':   return buildCrashLayers(map, id, lng, lat, typeId)
      case 'construction':
      case 'signal_damage': return buildConstructionLayers(map, id, lng, lat)
      case 'fall':          return buildFallLayers(map, id, lng, lat)
      case 'leaf_fall':     return buildLeafLayers(map, id, lng, lat)
      case 'bird_threat':   return buildBirdLayers(map, id, lng, lat)
      case 'slow_walker':   return buildSlowWalkerLayers(map, id, lng, lat)
      case 'ghost':         return buildGhostLayers(map, id, lng, lat)
      case 'distraction':   return buildDistractionLayers(map, id, lng, lat)
      default:              return null
    }
  } catch (_) { return null }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MapMarkersEffect({ mapRef }) {
  const { problems, selectProblem } = useApp()

  // id → { marker, el, layers:[], sources:[], rafId:null }
  const entriesRef = useRef({})

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const activeIds = new Set(problems.map(p => p.id))

    // ── Remove stale ──────────────────────────────────────────────────────
    for (const [id, entry] of Object.entries(entriesRef.current)) {
      if (activeIds.has(id)) continue
      cancelAnimationFrame(entry.rafId)
      entry.marker.remove()
      // Remove layers first, then sources
      for (const layerId of entry.layers) {
        try { if (map.getLayer(layerId))   map.removeLayer(layerId) } catch (_) {}
      }
      for (const srcId of entry.sources) {
        try { if (map.getSource(srcId))    map.removeSource(srcId) } catch (_) {}
      }
      delete entriesRef.current[id]
    }

    // ── Add new ───────────────────────────────────────────────────────────
    for (const p of problems) {
      if (entriesRef.current[p.id]) {
        const el = entriesRef.current[p.id].el
        if (p.aiActive) el.classList.add('pmk--ai-active')
        continue
      }

      // HTML Marker
      const el = document.createElement('div')
      el.innerHTML = markerHTML(p)
      el.style.cssText = 'position:relative;cursor:pointer;pointer-events:auto;'
      el.addEventListener('click', e => { e.stopPropagation(); selectProblem(p.id) })

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, 0] })
        .setLngLat([p.lng, p.lat])
        .addTo(map)

      // Map layers
      const layerResult = buildLayersForProblem(map, p)
      const layers  = layerResult?.layers  ?? []
      const sources = layerResult?.sources ?? []
      const tick    = layerResult?.tick    ?? null

      // Animation loop
      let rafId = null
      if (tick) {
        const loop = () => { tick(); rafId = requestAnimationFrame(loop) }
        rafId = requestAnimationFrame(loop)
      }

      entriesRef.current[p.id] = { marker, el, layers, sources, rafId }
    }
  }, [problems, selectProblem, mapRef])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const map = mapRef.current
      for (const entry of Object.values(entriesRef.current)) {
        cancelAnimationFrame(entry.rafId)
        entry.marker.remove()
        if (map) {
          for (const l of entry.layers)  try { if (map.getLayer(l))   map.removeLayer(l) } catch (_) {}
          for (const s of entry.sources) try { if (map.getSource(s))  map.removeSource(s) } catch (_) {}
        }
      }
      entriesRef.current = {}
    }
  }, [mapRef])

  return null
}
