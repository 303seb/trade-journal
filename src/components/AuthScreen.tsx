import { useState } from 'react'
import { TrendingUp, Mail, Lock, Eye, EyeOff, Loader } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setSuccess('Check your email for a confirmation link.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#0e0e0e',
    border: '1px solid #2a2a2a',
    borderRadius: 10,
    padding: '12px 14px 12px 42px',
    fontSize: 16,
    color: '#ffffff',
    outline: 'none',
    transition: 'border-color 0.15s',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0e0e0e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: '#1c1c1c', border: '1px solid #2a2a2a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}>
            <TrendingUp size={26} color="#e8e8e8" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#ffffff', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            The Market Element
          </h1>
          <p style={{ fontSize: 15, color: '#707070', margin: 0 }}>
            {mode === 'signin' ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#141414',
          border: '1px solid #222222',
          borderRadius: 18,
          padding: '32px 28px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Email */}
            <div style={{ position: 'relative' }}>
              <Mail size={16} color="#505050" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#484848')}
                onBlur={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
              />
            </div>

            {/* Password */}
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="#505050" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ ...inputStyle, paddingRight: 44 }}
                onFocus={e => (e.currentTarget.style.borderColor = '#484848')}
                onBlur={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#505050',
                  display: 'flex', padding: 4, transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#b0b0b0')}
                onMouseLeave={e => (e.currentTarget.style.color = '#505050')}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#ef4444',
              }}>
                {error}
              </div>
            )}

            {/* Success */}
            {success && (
              <div style={{
                background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#22c55e',
              }}>
                {success}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '13px', borderRadius: 10, border: 'none',
                background: loading ? '#2a2a2a' : '#f0f0f0',
                color: loading ? '#707070' : '#111111',
                fontSize: 16, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginTop: 4,
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#ffffff' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#f0f0f0' }}
            >
              {loading && <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Toggle mode */}
          <div style={{ textAlign: 'center', marginTop: 22 }}>
            <span style={{ fontSize: 15, color: '#707070' }}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            </span>
            <button
              onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(null); setSuccess(null) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#e8e8e8', fontWeight: 600, padding: 0 }}
            >
              {mode === 'signin' ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
