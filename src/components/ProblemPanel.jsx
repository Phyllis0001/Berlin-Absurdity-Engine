import { useApp, NORMAL_PROBLEMS, NONSENSE_PROBLEMS } from '../context/AppContext'

function ProblemBadge({ count }) {
  if (!count) return null
  return <span className="pp-badge">{count}</span>
}

function ActiveRow({ p, onSelect, isSelected }) {
  const age = Math.floor((Date.now() - p.spawnedAt) / 1000)
  return (
    <div
      className={`pp-active-row pp-active-row--${p.category}${isSelected ? ' pp-active-row--sel' : ''}${p.aiActive ? ' pp-active-row--ai' : ''}`}
      onClick={() => onSelect(p.id)}
    >
      <span className="pp-active-icon">{p.icon}</span>
      <div className="pp-active-body">
        <div className="pp-active-ailabel">{p.aiLabel}</div>
        <div className="pp-active-meta">
          <span className="pp-active-sev">{p.severity}</span>
          <span className="pp-active-age">{age}s</span>
          {p.aiActive && <span className="pp-active-aistate">AI_ENGAGED</span>}
        </div>
      </div>
      <span className="pp-active-arrow">{isSelected ? '▼' : '▶'}</span>
    </div>
  )
}

export default function ProblemPanel() {
  const { problems, spawnProblem, selectProblem, selectedId } = useApp()

  const normalActive   = problems.filter(p => p.category === 'normal')
  const nonsenseActive = problems.filter(p => p.category === 'nonsense')

  return (
    <div className="pp-panel">
      {/* ── Header ── */}
      <div className="pp-header">
        <span className="pp-header-icon">◈</span>
        INCIDENT REGISTRY&nbsp;//&nbsp;AI_RESPONSE_UNIT
        <ProblemBadge count={problems.length} />
      </div>

      <div className="pp-columns">
        {/* ── Normal problems ── */}
        <div className="pp-col">
          <div className="pp-col-title">
            NORMAL_INCIDENTS
            <ProblemBadge count={normalActive.length} />
          </div>
          <div className="pp-spawn-grid">
            {NORMAL_PROBLEMS.map(t => (
              <button
                key={t.typeId}
                className="pp-spawn-btn pp-spawn-btn--normal"
                onClick={() => spawnProblem(t)}
                title={`Spawn: ${t.label}`}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Nonsense problems ── */}
        <div className="pp-col">
          <div className="pp-col-title pp-col-title--nonsense">
            NON-SENSE_INCIDENTS
            <ProblemBadge count={nonsenseActive.length} />
          </div>
          <div className="pp-spawn-grid">
            {NONSENSE_PROBLEMS.map(t => (
              <button
                key={t.typeId}
                className="pp-spawn-btn pp-spawn-btn--nonsense"
                onClick={() => spawnProblem(t)}
                title={`Spawn: ${t.label}`}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Active incidents list ── */}
      {problems.length > 0 && (
        <>
          <div className="pp-divider" />
          <div className="pp-active-label">
            ACTIVE_INCIDENTS &mdash; CLICK FOR AI ANALYSIS
          </div>
          <div className="pp-active-list">
            {problems.map(p => (
              <ActiveRow
                key={p.id}
                p={p}
                onSelect={selectProblem}
                isSelected={selectedId === p.id}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
