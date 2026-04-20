import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";

export default function UpdatePassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase manda el token en el hash: #access_token=...&type=recovery
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const type = hashParams.get("type");

    if (accessToken && type === "recovery") {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken || "" })
        .then(({ error }) => {
          if (error) setMsg("Link inválido o expirado. Solicita uno nuevo.");
          else setReady(true);
        });
    } else {
      // fallback: query param (por si acaso)
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const qtype = params.get("type");
      if (token && qtype === "recovery") {
        supabase.auth.verifyOtp({ token_hash: token, type: "recovery" })
          .then(({ error }) => {
            if (error) setMsg("Link inválido o expirado. Solicita uno nuevo.");
            else setReady(true);
          });
      } else {
        setMsg("Link inválido o expirado. Solicita uno nuevo.");
      }
    }
  }, []);

  async function handleUpdate(e) {
    e.preventDefault();
    if (password !== confirm) { setMsg("Las contraseñas no coinciden"); return; }
    if (password.length < 6) { setMsg("Mínimo 6 caracteres"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) setMsg(error.message);
    else {
      setMsg("✅ Contraseña actualizada. Ya puedes iniciar sesión.");
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    }
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0a111e" }}>
      <div style={{ background:"rgba(255,255,255,0.05)", padding:32, borderRadius:12, width:340, border:"1px solid rgba(255,255,255,0.1)" }}>
        <h2 style={{ color:"#e8c872", marginBottom:24, fontFamily:"Georgia" }}>Nueva contraseña</h2>
        {!ready && !msg && <p style={{ color:"#aaa", fontSize:13 }}>Verificando link...</p>}
        {msg && <p style={{ color: msg.startsWith("✅") ? "#2ecc71" : "#e74c3c", fontSize:13 }}>{msg}</p>}
        {ready && (
          <form onSubmit={handleUpdate}>
            <input type="password" placeholder="Nueva contraseña" value={password} onChange={e=>setPassword(e.target.value)} required style={{ width:"100%", padding:"10px 12px", marginBottom:12, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:7, color:"#fff", boxSizing:"border-box" }} />
            <input type="password" placeholder="Confirmar contraseña" value={confirm} onChange={e=>setConfirm(e.target.value)} required style={{ width:"100%", padding:"10px 12px", marginBottom:16, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:7, color:"#fff", boxSizing:"border-box" }} />
            <button type="submit" disabled={loading} style={{ width:"100%", padding:"10px 0", background:"linear-gradient(135deg,#e8c872,#c9a84c)", color:"#0a1628", fontWeight:700, border:"none", borderRadius:7, cursor:"pointer" }}>
              {loading ? "Actualizando..." : "Actualizar contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
