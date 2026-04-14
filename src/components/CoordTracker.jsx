export default function CoordTracker({ coords }) {
  const { lng = 13.405, lat = 52.520, zoom = 15, bearing = 0, pitch = 45 } = coords ?? {}

  const fmt = (n, d = 6) => n.toFixed(d)

  return (
    <div className="coord-tracker">
      <div className="coord-tracker-header">◈&nbsp;COORD_TRACK&nbsp;//&nbsp;LIVE</div>
      <div className="coord-grid">
        <span className="coord-key">LNG</span>
        <span className="coord-val">{fmt(lng)}</span>
        <span className="coord-key">LAT</span>
        <span className="coord-val">{fmt(lat)}</span>
        <span className="coord-key">ALT</span>
        <span className="coord-val">z{fmt(zoom, 2)}</span>
        <span className="coord-key">BRG</span>
        <span className="coord-val">{fmt(bearing, 1)}°</span>
        <span className="coord-key">PCH</span>
        <span className="coord-val">{fmt(pitch, 1)}°</span>
      </div>
    </div>
  )
}
