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
    // 1) Parsear el HASH de la URL (no query params)
    //    Supabase envía: #access_token=xxx&refresh_token=yyy&type=recovery
    const hash = window.location.hash.substring(1) // quita el '#'
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type = params.get('type')
    const errorDesc = params.get('error_description')

    // 2) Si el link vino con error (expirado, ya usado, etc.)
    if (errorDesc) {
      setError(decodeURIComponent(errorDesc.replace(/\+/g, ' ')))
      setChecking(false)
      return
    }

    // 3) Si hay tokens en el hash → establecer sesión
    if (type === 'recovery' && accessToken && refreshToken) {
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      }).then(({ error }) => {
        setChecking(false)
        if (error) {
          setError('Link inválido o expirado. Solicita uno nuevo.')
        } else {
          setReady(true)
          // Limpia el hash de la URL por seguridad (oculta el token)
          window.history.replaceState(null, '', window.location.pathname)
        }
      })
      return
    }

    // 4) Fallback: escuchar evento PASSWORD_RECOVERY
    //    (por si Supabase ya procesó el hash automáticamente)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
        setChecking(false)
      }
    })

    // 5) Timeout de 2s: si no llegó ni hash ni evento, mostrar error
    const timeout = setTimeout(() => {
      setChecking(false)
      if (!ready) {
        setError('Link de recuperación inválido o expirado. Solicita un nuevo enlace desde la pantalla de login.')
      }
    }, 2000)

    return () => {
      subscription?.unsubscribe()
      clearTimeout(timeout)
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
      // Cerrar sesión temporal y redirigir a login tras 2s
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

  // Estado: verificando token
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

  // Estado: éxito
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

  // Estado: error de link (sin form)
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

  // Estado: formulario listo
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
