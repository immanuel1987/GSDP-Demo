import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import './AiAssistantDock.css'

const EXAMPLES = [
  'Find resources on the Preventive System in Latin America (1950–1970)',
  'Compare two encyclicals on youth ministry',
  'Summarise the 29th General Chapter',
]

/**
 * @param {{ variant?: 'app' | 'public' }} props
 * - `app` (default): signed-in dashboard — Send / Open go to `/dashboard/ai`.
 * - `public`: marketing home — actions go to sign-in with optional `prefilledPrompt` for after login.
 */
export function AiAssistantDock({ variant = 'app' } = {}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const panelId = variant === 'public' ? 'hp-ai-dock-panel-public' : 'hp-ai-dock-panel'

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const sendPrompt = () => {
    setOpen(false)
    const q = draft.trim()
    if (variant === 'public') {
      navigate('/login', q ? { state: { prefilledPrompt: q } } : {})
      return
    }
    navigate('/dashboard/ai', q ? { state: { prefilledPrompt: q } } : {})
  }

  const openWorkspaceOnly = () => {
    setOpen(false)
    if (variant === 'public') {
      navigate('/login')
      return
    }
    navigate('/dashboard/ai', {})
  }

  const subtitle =
    variant === 'public'
      ? 'Draft a question here, then sign in to run it in the full AI Assistant.'
      : 'Quick prompts — opens the full AI Assistant workspace.'

  const primaryLabel = variant === 'public' ? 'Sign in →' : 'Open AI Assistant →'

  const dock = (
    <div className={`hp-ai-dock hp-ai-dock--${variant}${open ? ' is-open' : ''}`}>
      <div
        id={panelId}
        className="hp-ai-dock-panel"
        role="dialog"
        aria-modal={open ? 'true' : 'false'}
        aria-labelledby="hp-ai-dock-title"
        aria-hidden={open ? 'false' : 'true'}
      >
        <div className="hp-ai-dock-head">
          <div>
            <div id="hp-ai-dock-title" className="hp-ai-dock-title">AI assistant</div>
            <p className="hp-ai-dock-sub">{subtitle}</p>
          </div>
          <button type="button" className="hp-ai-dock-close" aria-label="Close" onClick={() => setOpen(false)}>
            ×
          </button>
        </div>
        <p className="hp-ai-dock-hint">Try an example:</p>
        <div className="hp-ai-dock-chips">
          {EXAMPLES.map((q) => (
            <button key={q} type="button" className="hp-ai-dock-chip" onClick={() => setDraft(q)}>
              {q}
            </button>
          ))}
        </div>
        <div className="hp-ai-dock-input-row">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask in natural language…"
            className="hp-ai-dock-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendPrompt()
            }}
          />
        </div>
        <div className="hp-ai-dock-actions">
          <button type="button" className="hp-ai-dock-send-secondary" onClick={sendPrompt}>
            Send
          </button>
          <button type="button" className="hp-ai-dock-send" onClick={openWorkspaceOnly}>
            {primaryLabel}
          </button>
        </div>
      </div>
      <button
        type="button"
        className="hp-ai-dock-fab"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="hp-ai-dock-fab-ic" aria-hidden>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" />
          </svg>
        </span>
        <span className="hp-ai-dock-fab-lbl">Ask AI</span>
      </button>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(dock, document.body) : null
}
