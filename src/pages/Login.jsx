import { useState } from "react";
import { Lock, Mail, LogIn, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const manejarLogin = async (e) => {
    e?.preventDefault?.();
    setError(null);

    if (!email || !password) {
      setError("Ingresa tu correo y contraseña.");
      return;
    }

     setCargando(true);

    /

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setCargando(false);

    if (authError) {
      if (authError.message.includes("Invalid login")) {
        setError("Correo o contraseña incorrectos.");
      } else {
        setError(authError.message);
      }
      return;
    }

    if (data?.user) {
      if (onLoginSuccess) onLoginSuccess(data.user);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #1a1410 0%, #0f0a06 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "'Cormorant Garamond', Georgia, serif",
      color: "#f5ead8",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600&family=Italiana&display=swap" rel="stylesheet" />

      <div style={{
        width: "100%",
        maxWidth: "420px",
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            fontSize: "10px",
            letterSpacing: "0.4em",
            fontFamily: "'Inter', sans-serif",
            fontWeight: 500,
            color: "#d4a574",
            marginBottom: "12px",
            textTransform: "uppercase",
          }}>
            Grupo Mittoz · Isla Holbox
          </div>
          <h1 style={{
            fontSize: "42px",
            fontWeight: 400,
            margin: 0,
            letterSpacing: "0.02em",
            fontFamily: "'Italiana', 'Cormorant Garamond', serif",
            color: "#f5ead8",
            lineHeight: 1.1,
          }}>
            Holbox Dining
          </h1>
          <div style={{
            width: "60px",
            height: "1px",
            background: "linear-gradient(90deg, transparent, #d4a574, transparent)",
            margin: "16px auto 12px",
          }} />
          <p style={{
            fontSize: "14px",
            fontFamily: "'Cormorant Garamond', serif",
            color: "#c9b896",
            margin: 0,
            fontWeight: 300,
            fontStyle: "italic",
          }}>
            Panel interno del equipo
          </p>
        </div>

        {/* Card de login */}
        <div style={{
          background: "#fdfbf7",
          borderRadius: "18px",
          padding: "32px 28px",
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.4)",
          border: "1px solid rgba(212, 165, 116, 0.2)",
        }}>
          <div style={{
            fontSize: "11px",
            letterSpacing: "0.2em",
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            color: "#8b7355",
            textTransform: "uppercase",
            marginBottom: "6px",
          }}>
            Iniciar sesión
          </div>
          <h2 style={{
            fontSize: "26px",
            margin: "0 0 24px 0",
            color: "#2c2416",
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}>
            Bienvenido de vuelta
          </h2>

          {/* Email */}
          <div style={{ marginBottom: "14px" }}>
            <label style={labelStyle}>
              <Mail size={14} /> Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && manejarLogin()}
              placeholder="tu@correo.com"
              style={inputStyle}
              autoComplete="email"
              autoFocus
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: "18px" }}>
            <label style={labelStyle}>
              <Lock size={14} /> Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && manejarLogin()}
              placeholder="••••••••"
              style={inputStyle}
              autoComplete="current-password"
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: "#fdecea",
              border: "1px solid #f5c2c7",
              color: "#842029",
              padding: "10px 12px",
              borderRadius: "8px",
              fontSize: "13px",
              fontFamily: "'Inter', sans-serif",
              marginBottom: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}>
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={manejarLogin}
            disabled={cargando}
            style={{
              width: "100%",
              background: cargando ? "#999" : "#1a3a2e",
              color: "white",
              border: "none",
              padding: "14px",
              borderRadius: "10px",
              fontFamily: "'Inter', sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              cursor: cargando ? "not-allowed" : "pointer",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {cargando ? (
              <>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                Entrando...
              </>
            ) : (
              <>
                <LogIn size={16} />
                Iniciar sesión
              </>
            )}
          </button>

          <div style={{
            textAlign: "center",
            marginTop: "16px",
            fontSize: "11px",
            fontFamily: "'Inter', sans-serif",
            color: "#a08968",
          }}>
            ¿Problemas para entrar? Contacta a tu ¿Olvidaste tu contraseña? <button onClick={async () => { const email = document.querySelector('input[type="email"]')?.value; if (!email) { alert("Ingresa tu correo primero"); return; } const { supabase } = await import("../lib/supabase"); const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: "https://mittoz-reservas-dining.vercel.app/update-password" }); if (error) alert(error.message); else alert("✅ Revisa tu correo para restablecer tu contraseña"); }} style={{ background: "none", border: "none", color: "#8B6914", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>Haz clic aquí</button>
          </div>
        </div>

        {/* Volver a landing pública */}
        <div style={{ textAlign: "center", marginTop: "24px" }}>
          <a
            href="/"
            style={{
              color: "#d4a574",
              fontSize: "12px",
              fontFamily: "'Inter', sans-serif",
              textDecoration: "none",
              letterSpacing: "0.05em",
            }}
          >
            ← Volver a la página pública
          </a>
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "11px",
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  color: "#6b5d47",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: "6px",
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  border: "1.5px solid #e8dfd0",
  borderRadius: "10px",
  fontFamily: "'Inter', sans-serif",
  fontSize: "14px",
  background: "#fdfbf7",
  color: "#2c2416",
  outline: "none",
  boxSizing: "border-box",
};
