import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { buildSessionFromLoginResponse, postLoginPath } from '../auth/loginSession'
import { getSession, setSession } from '../auth/session'
import { apiLogin } from '../lib/authApi'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const existing = getSession()
    if (existing?.role) {
      const p = typeof location.state?.prefilledPrompt === 'string' ? location.state.prefilledPrompt.trim() : ''
      if (p) {
        navigate('/dashboard/ai', { replace: true, state: { prefilledPrompt: p } })
      } else {
        navigate(postLoginPath(existing.role), { replace: true })
      }
    }
  }, [navigate, location.key])

  async function handleSubmit(e) {
    e.preventDefault()
    const id = login.trim()
    if (!id || !password) {
      setError('Please enter your email or username and password.')
      return
    }
    setError('')
    setInfo('')
    setSubmitting(true)
    try {
      const data = await apiLogin(id, password)
      const sessionPayload = buildSessionFromLoginResponse(data)
      setSession(sessionPayload)
      const p = typeof location.state?.prefilledPrompt === 'string' ? location.state.prefilledPrompt.trim() : ''
      if (p) {
        navigate('/dashboard/ai', { replace: true, state: { prefilledPrompt: p } })
      } else {
        navigate(postLoginPath(sessionPayload.role), { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.')
      setInfo('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center overflow-hidden p-5"
      style={{
        background: 'linear-gradient(150deg,#001428 0%,#002850 35%,#003A75 65%,#004B96 100%)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-[120px] -top-[160px] size-[600px] rounded-full bg-[radial-gradient(circle,rgba(232,96,10,0.12),transparent_65%)]" />
        <div className="absolute -bottom-[200px] -left-[100px] size-[700px] rounded-full bg-[radial-gradient(circle,rgba(0,87,168,0.2),transparent_65%)]" />
        <div className="absolute left-[5%] top-[40%] h-[40%] w-px bg-gradient-to-b from-transparent via-white/[0.06] to-transparent" />
        <div className="absolute right-[8%] top-[20%] h-[55%] w-px bg-gradient-to-b from-transparent via-sdb-orange/12 to-transparent" />
      </div>

      <div className="relative z-[1] mx-5 w-full max-w-[440px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 inline-flex size-16 items-center justify-center rounded-full bg-sdb-orange text-[28px] text-white shadow-[0_0_0_8px_rgba(232,96,10,0.18),0_8px_32px_rgba(0,0,0,0.3)]">
            ✝
          </div>
          <div className="mb-1 font-serif text-xl font-bold leading-tight text-white">
            Global Salesian Digital Platform
          </div>
          <div className="text-[13px] text-white/55">
            Salesian Congregation · South Asia coordination
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/14 bg-white/[0.07] p-8 shadow-[0_24px_64px_rgba(0,0,0,0.35)] backdrop-blur-md"
        >
          <div className="mb-1 font-serif text-lg font-bold text-white">Sign in</div>
          <p className="mb-6 text-[13px] text-white/55">Access the Salesian knowledge platform</p>



          {error ? (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-400/40 bg-red-500/20 px-3.5 py-2.5 text-[13px] text-[#ffb3b3]"
            >
              {error}
            </div>
          ) : null}
          {info ? (
            <div className="mb-4 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-3.5 py-2.5 text-[13px] text-emerald-100">
              {info}
            </div>
          ) : null}

          <div className="mb-3.5">
            <label
              htmlFor="login-id"
              className="mb-1.5 block text-xs font-semibold tracking-wide text-white/70"
            >
              Email or username
            </label>
            <input
              id="login-id"
              type="text"
              autoComplete="username"
              placeholder="you@donbosco.org or jdoe"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full rounded-lg border border-white/18 bg-white/[0.08] px-3.5 py-2.5 font-sans text-sm text-white outline-none transition-colors placeholder:text-white/40 focus:border-sdb-orange/60"
            />
          </div>

          <div className="mb-3.5">
            <label
              htmlFor="login-pass"
              className="mb-1.5 block text-xs font-semibold tracking-wide text-white/70"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="login-pass"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/18 bg-white/[0.08] py-2.5 pl-3.5 pr-11 font-sans text-sm text-white outline-none transition-colors placeholder:text-white/40 focus:border-sdb-orange/60"
              />
              <button
                type="button"
                className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-white/55 outline-none transition-colors hover:bg-white/10 hover:text-white/90 focus-visible:ring-2 focus-visible:ring-sdb-orange/50"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
                    />
                    <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M1 1l22 22" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"
                    />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mb-3 w-full cursor-pointer rounded-lg border-none bg-sdb-orange py-3.5 font-sans text-[15px] font-bold tracking-wide text-white transition-[filter] hover:brightness-110 disabled:opacity-70"
          >
            {submitting ? 'Signing in…' : 'Sign In →'}
          </button>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              to="/"
              className="border-none bg-transparent p-0 text-xs text-white/50 no-underline transition-colors hover:text-white/85"
            >
              ← Back to homepage
            </Link>
            <button
              type="button"
              className="border-none bg-transparent p-0 text-xs text-white/40 transition-colors hover:text-white/70"
              onClick={() => {
                setInfo('Contact your administrator to reset your password.')
                setError('')
              }}
            >
              Forgot password?
            </button>
          </div>
        </form>

        <p className="mt-5 text-center text-xs leading-relaxed text-white/30">
          Access restricted to Salesian Family members and authorised partners.
          <br />
          Open access resources available without sign-in on the public homepage.
        </p>
      </div>
    </div>
  )
}
