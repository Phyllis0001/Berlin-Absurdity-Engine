import { useEffect, useState, useRef } from 'react'
import { useApp } from '../context/AppContext'

export default function AISolutionModal() {
  const { selectedProblem, selectProblem } = useApp()
  const [typed, setTyped]   = useState('')
  const [phase, setPhase]   = useState('idle')   // idle | thinking | solution
  const timerRef = useRef(null)

  useEffect(() => {
    if (!selectedProblem) { setPhase('idle'); setTyped(''); return }

    setPhase('thinking')
    setTyped('')

    timerRef.current = setTimeout(() => {
      setPhase('solution')
      const full = selectedProblem.aiSolution ?? 'CLASSIFIED.'
      let i = 0
      const iv = setInterval(() => {
        i++
        setTyped(full.slice(0, i))
        if (i >= full.length) clearInterval(iv)
      }, 18)
      return () => clearInterval(iv)
    }, 900)

    return () => clearTimeout(timerRef.current)
  }, [selectedProblem?.id]) // eslint-disable-line

  if (!selectedProblem) return null

  const isNonsense = selectedProblem.category === 'nonsense'

  return (
    <div className="ai-modal-backdrop" onClick={() => selectProblem(selectedProblem.id)}>
      <div className="ai-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="ai-modal-header">
          <span className="ai-modal-brace">{'['}</span>
          {isNonsense ? 'ABSURDITY_ENGINE' : 'CRISIS_RESPONSE_UNIT'}
          <span className="ai-modal-brace">{']'}</span>
          <button className="ai-modal-close" onClick={() => selectProblem(selectedProblem.id)}>✕</button>
        </div>

        <div className="ai-modal-stripe" />

        {/* Problem identity */}
        <div className="ai-modal-problem">
          <span className="ai-modal-icon">{selectedProblem.icon}</span>
          <div className="ai-modal-problem-text">
            <div className="ai-modal-type">{selectedProblem.label.toUpperCase()}</div>
            <div className={`ai-modal-ailabel${isNonsense ? ' ai-modal-ailabel--nonsense' : ''}`}>
              ▶ {selectedProblem.aiLabel}
            </div>
            <div className="ai-modal-severity">
              SEVERITY: <span className="ai-modal-severity-val">{selectedProblem.severity}</span>
            </div>
          </div>
        </div>

        <div className="ai-modal-divider" />

        {/* AI response area */}
        <div className="ai-modal-response">
          <div className="ai-modal-response-label">
            {phase === 'thinking' ? (
              <span className="ai-modal-thinking">
                ◈ AI CALCULATING OPTIMAL_RESPONSE
                <span className="ai-modal-ellipsis" />
              </span>
            ) : (
              <span>◈ AI_RESPONSE // <span className="ai-modal-action">ENGAGE PROTOCOL</span></span>
            )}
          </div>

          {phase === 'solution' && (
            <div className="ai-modal-text">
              {typed}
              {typed.length < (selectedProblem.aiSolution?.length ?? 0) && (
                <span className="ai-modal-cursor">▮</span>
              )}
            </div>
          )}
        </div>

        {/* Footer warning */}
        <div className="ai-modal-footer">
          ⚠ PROBLEM STATUS: <span className="ai-modal-status">NOT RESOLVED — EXAGGERATED</span>
          &nbsp;// COLLATERAL: +{Math.floor(Math.random() * 9000 + 1000)}%
        </div>
      </div>
    </div>
  )
}
