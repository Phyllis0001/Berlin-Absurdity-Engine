import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'

export default function WarningOverlay() {
  const { warning } = useApp()
  const [visible, setVisible] = useState(false)
  const [dots, setDots] = useState('')

  useEffect(() => {
    if (warning) {
      setVisible(true)
      setDots('')
    } else {
      const t = setTimeout(() => setVisible(false), 600)
      return () => clearTimeout(t)
    }
  }, [warning])

  useEffect(() => {
    if (!visible) return
    const iv = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 220)
    return () => clearInterval(iv)
  }, [visible])

  if (!visible) return null

  const fading = !warning

  return (
    <div className={`warn-overlay${fading ? ' warn-overlay--fade' : ''}`}>
      {/* Screen-edge border pulse */}
      <div className="warn-border" />

      {/* Central message banner */}
      <div className="warn-banner">
        <div className="warn-banner-stripe" />
        <div className="warn-banner-content">
          <span className="warn-label">⚠ SYSTEM WARNING ⚠</span>
          <span className="warn-msg">{warning?.msg}{dots}</span>
          <span className="warn-sub">
            // TYPE: {warning?.severity ?? '---'} &nbsp;|&nbsp; TS: {Date.now()}
          </span>
        </div>
        <div className="warn-banner-stripe" />
      </div>

      {/* Corner brackets */}
      <svg className="warn-corners" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* TL */}
        <polyline points="0,12 0,0 12,0" fill="none" stroke="#FF2200" strokeWidth="0.8" />
        {/* TR */}
        <polyline points="88,0 100,0 100,12" fill="none" stroke="#FF2200" strokeWidth="0.8" />
        {/* BL */}
        <polyline points="0,88 0,100 12,100" fill="none" stroke="#FF2200" strokeWidth="0.8" />
        {/* BR */}
        <polyline points="88,100 100,100 100,88" fill="none" stroke="#FF2200" strokeWidth="0.8" />
      </svg>
    </div>
  )
}
