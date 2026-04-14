import { useEffect, useState, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'

// ── Web Audio beep ─────────────────────────────────────────────────────────────
function playBeep(freq1 = 880, freq2 = 440, duration = 0.25, volume = 0.22) {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'square'
    osc.frequency.setValueAtTime(freq1, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(freq2, ctx.currentTime + duration)
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start()
    osc.stop(ctx.currentTime + duration)
    // close context after sound ends to avoid resource leak
    setTimeout(() => ctx.close(), (duration + 0.1) * 1000)
  } catch (_) {}
}

// ── Speak text via Web Speech API ─────────────────────────────────────────────
function speak(text) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance    = new SpeechSynthesisUtterance(text)
  utterance.rate     = 0.88
  utterance.pitch    = 0.55   // low, robotic
  utterance.volume   = 1
  // prefer a deep/robotic voice if available
  const voices = window.speechSynthesis.getVoices()
  const robotic = voices.find(v =>
    v.name.toLowerCase().includes('google') ||
    v.name.toLowerCase().includes('en-us') ||
    v.lang === 'en-US'
  )
  if (robotic) utterance.voice = robotic
  window.speechSynthesis.speak(utterance)
}

export default function AISolutionModal() {
  const { selectedProblem, selectProblem, soundEnabled } = useApp()
  const [typed, setTyped] = useState('')
  const [phase, setPhase] = useState('idle')  // idle | thinking | solution
  const timerRef  = useRef(null)
  const soundRef  = useRef(soundEnabled)

  // Keep soundRef in sync without re-running the effect
  useEffect(() => { soundRef.current = soundEnabled }, [soundEnabled])

  useEffect(() => {
    if (!selectedProblem) { setPhase('idle'); setTyped(''); return }

    setPhase('thinking')
    setTyped('')

    // Beep on AI "calculating" phase
    if (soundRef.current) playBeep(1100, 550, 0.28)

    timerRef.current = setTimeout(() => {
      setPhase('solution')
      const full = selectedProblem.aiSolution ?? 'CLASSIFIED.'

      // Narrate the problem + solution
      if (soundRef.current) {
        speak(
          `Alert. ${selectedProblem.label}. AI Protocol: ${selectedProblem.aiLabel}. Solution: ${full}`
        )
      }

      // Type-on animation
      let i = 0
      const iv = setInterval(() => {
        i++
        setTyped(full.slice(0, i))
        if (i >= full.length) clearInterval(iv)
      }, 18)
      return () => clearInterval(iv)
    }, 900)

    return () => {
      clearTimeout(timerRef.current)
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
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
