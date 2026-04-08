import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase, obtenerPerfil } from "./lib/supabase";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";

export default function App() {
  const [ruta, setRuta] = useState(window.location.pathname);
  const [sesion, setSesion] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);

  // Escuchar cambios de URL (back/forward del navegador)
  useEffect(() => {
    const onPopState = () => setRuta(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Helper para navegar programáticamente
  const navegar = (nuevaRuta) => {
    window.history.pushState({}, "", nuevaRuta);
    setRuta(nuevaRuta);
  };

  // Al iniciar: revisar si hay sesión activa
  useEffect(() => {
    const revisarSesion = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSesion(session);
      if (session?.user) {
        const p = await obtenerPerfil();
        setPerfil(p);
      }
      setCargandoSesion(false);
    };
    revisarSesion();

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSesion(newSession);
        if (newSession?.user) {
          const p = await obtenerPerfil();
          setPerfil(p);
        } else {
          setPerfil(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Pantalla de carga inicial mientras checamos sesión
  if (cargandoSesion) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #1a1410 0%, #0f0a06 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#d4a574",
        flexDirection: "column",
        gap: "16px",
        fontFamily: "'Inter', sans-serif",
      }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
        <div style={{ fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase" }}>
          Cargando...
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // RUTA: /login
  if (ruta === "/login" || ruta.startsWith("/login")) {
    // Si ya está logueado, redirigir al dashboard
    if (sesion && perfil) {
      navegar("/dashboard");
      return null;
    }
    return <Login onLoginSuccess={() => navegar("/dashboard")} />;
  }

  // RUTA: /dashboard
  if (ruta === "/dashboard" || ruta.startsWith("/dashboard")) {
    // Si no está logueado, redirigir al login
    if (!sesion || !perfil) {
      navegar("/login");
      return null;
    }
    // Verificar que el perfil esté activo
    if (!perfil.activo) {
      return (
        <div style={{
          minHeight: "100vh",
          background: "#1a1410",
          color: "#f5ead8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          textAlign: "center",
          fontFamily: "'Inter', sans-serif",
        }}>
          <div>
            <div style={{ fontSize: "20px", marginBottom: "12px" }}>⚠️ Cuenta inactiva</div>
            <div style={{ fontSize: "14px", color: "#c9b896" }}>
              Tu cuenta está desactivada. Contacta al administrador.
            </div>
            <button
              onClick={async () => { await supabase.auth.signOut(); navegar("/login"); }}
              style={{
                marginTop: "20px",
                background: "#d4a574",
                color: "#1a1410",
                border: "none",
                padding: "10px 20px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      );
    }
    return <Dashboard perfil={perfil} onLogout={() => navegar("/login")} />;
  }

  // RUTA: / (default) — landing pública
  return <Landing />;
}
