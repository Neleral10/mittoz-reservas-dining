import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'

export default function UpdatePassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [success, setSuccess] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    let subscription = null
    let timeoutId = null

    const init = async () => {
      // ===== PATRÓN NUEVO (recomendado): token_hash en query params =====
      // Resistente a pre-fetch de scanners de email (Gmail, Outlook, etc.)
      const urlParams = new URLSearchParams(window.location.search)
      const tokenHash = urlParams.get('token_hash')
      const qType = urlParams.get('type')

      if (tokenHash && qType === 'recovery') {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery'
        })
        if (cancelled) return
        setChecking(false)
        if (error) {
          setError('Link inválido o expirado. Solicita uno nuevo desde el login.')
        } else {
          setReady(true)
          window.history.replaceState(null, '', window.location.pathname)
        }
        return
      }

      // ===== PATRÓN VIEJO: hash con access_token/refresh_token =====
      const hash = window.location.hash.substring(1)
      const hashParams = new URLSearchParams(hash)
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const hashType = hashParams.get('type')
      const errorDesc = hashParams.get('error_description')

      if (errorDesc) {
        setError(decodeURIComponent(errorDesc.replace(/\+/g, ' ')))
        setChecking(false)
        return
      }

      if (hashType === 'recovery' && accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        })
        if (cancelled) return
        setChecking(false)
        if (error) {
          setError('Link inválido o expirado. Solicita uno nuevo.')
        } else {
          setReady(true)
          window.history.replaceState(null, '', window.location.pathname)
        }
        return
      }

      // ===== FALLBACK: evento PASSWORD_RECOVERY =====
      const res = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY' && !cancelled) {
          setReady(true)
          setChecking(false)
        }
      })
      subscription = res?.data?.subscription

      timeoutId = setTimeout(() => {
        if (cancelled) return
        setChecking(false)
        setReady(prev => {
          if (!prev) {
            setError('Link de recuperación inválido o expirado. Solicita uno nuevo desde la pantalla de login.')
          }
          return prev
        })
      }, 2500)
    }

    init()

    return () => {
      cancelled = true
      subscription?.unsubscribe?.()
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [])

  const handleSubmit = async () => {
    setError('')
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      setTimeout(async () => {
        await supabase.auth.signOut()
        window.location.href = '/'
      }, 2000)
    }
  }

  // ===== UI =====
  const container = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0c1829',
    padding: 20,
    fontFamily: 'system-ui, -apple-system, sans-serif'
  }
  const card = {
    background: '#12263f',
    border: '1px solid #e8c87244',
    borderRadius: 12,
    padding: 32,
    width: '100%',
    maxWidth: 420,
    color: '#fff'
  }
  const title = { fontSize: 20, fontWeight: 700, color: '#e8c872', marginBottom: 4 }
  const subtitle = { fontSize: 13, color: '#9ba3b4', marginBottom: 24 }
  const label = { display: 'block', fontSize: 12, color: '#9ba3b4', marginBottom: 6, marginTop: 12 }
  const input = {
    width: '100%',
    padding: '10px 12px',
    background: '#0c1829',
    border: '1px solid #2a3a55',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
    boxSizing: 'border-box'
  }
  const btn = {
    width: '100%',
    padding: '12px',
    background: loading || !ready ? '#2a3a55' : '#e8c872',
    color: loading || !ready ? '#9ba3b4' : '#0c1829',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: loading || !ready ? 'not-allowed' : 'pointer',
    marginTop: 20
  }
  const errorBox = {
    background: 'rgba(231,76,60,0.12)',
    color: '#e74c3c',
    padding: '10px 12px',
    borderRadius: 8,
    fontSize: 13,
    marginTop: 12
  }
  const successBox = {
    background: 'rgba(46,204,113,0.12)',
    color: '#2ecc71',
    padding: '10px 12px',
    borderRadius: 8,
    fontSize: 13,
    marginTop: 12
  }

  if (checking) {
    return (
      <div style={container}>
        <div style={card}>
          <div style={title}>Verificando enlace...</div>
          <div style={subtitle}>Un momento por favor</div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div style={container}>
        <div style={card}>
          <div style={title}>✓ Contraseña actualizada</div>
          <div style={subtitle}>Redirigiendo al login...</div>
          <div style={successBox}>Tu contraseña se cambió correctamente. Inicia sesión con la nueva.</div>
        </div>
      </div>
    )
  }

  if (!ready && error) {
    return (
      <div style={container}>
        <div style={card}>
          <div style={title}>Enlace no válido</div>
          <div style={subtitle}>No pudimos verificar tu solicitud de recuperación</div>
          <div style={errorBox}>{error}</div>
          <button
            style={{ ...btn, background: '#e8c872', color: '#0c1829', cursor: 'pointer' }}
            onClick={() => (window.location.href = '/')}
          >
            Volver al login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={container}>
      <div style={card}>
        <div style={title}>Nueva contraseña</div>
        <div style={subtitle}>Holbox Dining · Grupo Mittoz</div>

        <label style={label}>Nueva contraseña</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={input}
          placeholder="Mínimo 6 caracteres"
          autoFocus
        />

        <label style={label}>Confirmar contraseña</label>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          style={input}
          placeholder="Repite la contraseña"
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />

        {error && <div style={errorBox}>{error}</div>}

        <button style={btn} onClick={handleSubmit} disabled={loading || !ready}>
          {loading ? 'Actualizando...' : 'Cambiar contraseña'}
        </button>
      </div>
    </div>
  )
}
