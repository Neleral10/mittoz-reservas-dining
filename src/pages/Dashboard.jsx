import { useState, useEffect, useCallback } from "react";
import {
  LogOut, Calendar, Users, Clock, Phone, Hotel, MessageSquare,
  CheckCircle2, XCircle, Loader2, RefreshCw, Filter, User, Sparkles,
  DollarSign, ClipboardList, History
} from "lucide-react";
import { supabase, RESTAURANTES_INFO } from "../lib/supabase";import CorteComisiones from "../CorteComisiones";import Reportes from "./Reportes";


const ROL_LABEL = {
  admin: "Administrador",
  fb_manager: "F&B Manager",
  hostess: "Hostess",
  validador: "Validador",
};

function getSemanaISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const w1 = new Date(d.getFullYear(), 0, 4);
  const wn = String(1 + Math.round(((d - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7)).padStart(2, "0");
  return `${d.getFullYear()}-W${wn}`;
}

export default function Dashboard({ perfil, onLogout }) {
  const [tab, setTab] = useState("hoy");
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtroRestaurante, setFiltroRestaurante] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [accionandoId, setAccionandoId] = useState(null);
  const [modalConsumo, setModalConsumo] = useState(null);
  const [validaciones, setValidaciones] = useState([]);
  const [cargandoVal, setCargandoVal] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [cargandoHist, setCargandoHist] = useState(false);
  const [semanaFiltro, setSemanaFiltro] = useState(getSemanaISO());

  const hoy = new Date().toISOString().split("T")[0];

  const cargarReservas = useCallback(async () => {
    setCargando(true);
    setError(null);
    let query = supabase.from("reservas").select("*").eq("fecha", hoy).order("hora", { ascending: true });
    if (perfil.rol === "hostess" && perfil.restaurante_asignado) {
      query = query.eq("restaurante_id", perfil.restaurante_asignado);
    }
    const { data, error: queryError } = await query;
    if (queryError) { setError(queryError.message); setCargando(false); return; }
    setReservas(data || []);
    setCargando(false);
  }, [hoy, perfil.rol, perfil.restaurante_asignado]);

  const cargarValidaciones = useCallback(async () => {
    setCargandoVal(true);
    const { data, error } = await supabase
      .from("reservas")
      .select("*")
      .eq("validacion_estado", "pendiente")
      .order("consumo_registrado_at", { ascending: true });
    if (!error) setValidaciones(data || []);
    setCargandoVal(false);
  }, []);

  const cargarHistorico = useCallback(async () => {
    setCargandoHist(true);
    const { data, error } = await supabase
      .from("reservas")
      .select("*")
      .eq("semana_corte", semanaFiltro)
      .eq("validacion_estado", "aprobada")
      .order("validado_at", { ascending: false });
    if (!error) setHistorico(data || []);
    setCargandoHist(false);
  }, [semanaFiltro]);

  useEffect(() => { cargarReservas(); }, [cargarReservas]);

  useEffect(() => {
    if (tab === "validaciones") cargarValidaciones();
    if (tab === "historico") cargarHistorico();
  }, [tab, cargarValidaciones, cargarHistorico]);

  useEffect(() => {
    const canal = supabase.channel("reservas-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservas" }, () => {
        cargarReservas();
        if (tab === "validaciones") cargarValidaciones();
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [cargarReservas, cargarValidaciones, tab]);

  const cambiarEstado = async (reservaId, nuevoEstado) => {
    setAccionandoId(reservaId);
    const act = { estado: nuevoEstado, updated_at: new Date().toISOString() };
    if (nuevoEstado === "llegado" || nuevoEstado === "no_show") {
      act.marcado_llegado_por = perfil.email;
      act.marcado_llegado_at = new Date().toISOString();
    }
    const { error: updateError } = await supabase.from("reservas").update(act).eq("id", reservaId);
    setAccionandoId(null);
    if (updateError) { alert("Error al actualizar: " + updateError.message); return; }
    cargarReservas();
  };

  const registrarConsumo = async (reservaId, subtotal) => {
    const comision = Math.round(subtotal * 0.05 * 100) / 100;
    const { error } = await supabase.from("reservas").update({
      consumo_subtotal: subtotal,
      comision_monto: comision,
      consumo_registrado_por: perfil.email,
      consumo_registrado_at: new Date().toISOString(),
      validacion_estado: "pendiente",
      semana_corte: getSemanaISO(),
      updated_at: new Date().toISOString(),
    }).eq("id", reservaId);
    if (error) { alert("Error: " + error.message); return; }
    setModalConsumo(null);
    cargarReservas();
  };

  const validarComision = async (reservaId, aprobada) => {
    setAccionandoId(reservaId);
    const { error } = await supabase.from("reservas").update({
      validacion_estado: aprobada ? "aprobada" : "rechazada",
      validado_por: perfil.email,
      validado_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", reservaId);
    setAccionandoId(null);
    if (error) { alert("Error: " + error.message); return; }
    cargarValidaciones();
  };

  const cerrarSesion = async () => { await supabase.auth.signOut(); if (onLogout) onLogout(); };

  const reservasFiltradas = reservas.filter((r) => {
    if (filtroRestaurante !== "todos" && r.restaurante_id !== filtroRestaurante) return false;
    if (filtroEstado !== "todos" && r.estado !== filtroEstado) return false;
    return true;
  });

  const stats = {
    total: reservas.length,
    pendientes: reservas.filter((r) => r.estado === "pendiente" || r.estado === "confirmada").length,
    llegados: reservas.filter((r) => r.estado === "llegado").length,
    noShow: reservas.filter((r) => r.estado === "no_show").length,
    personas: reservas.reduce((sum, r) => sum + (r.personas || 0), 0),
  };

  const mostrarFiltroRestaurante = perfil.rol !== "hostess";
  const puedeVerValidaciones = ["admin", "fb_manager", "validador"].includes(perfil.rol);
  const puedeVerHistorico = ["admin", "fb_manager"].includes(perfil.rol);

  const titulos = { hoy: "Reservaciones de hoy", validaciones: "Cola de validaciones", historico: "Histórico de comisiones", comisiones: "Corte de Comisiones", reportes: "Reportes" };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f5ead8 0%, #ebdcc0 100%)", fontFamily: "'Inter', -apple-system, sans-serif", color: "#2c2416" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&family=Italiana&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <header style={{ background: "#1a1410", color: "#f5ead8", padding: "18px 20px 0", borderBottom: "2px solid #d4a574", position: "sticky", top: 0, zIndex: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", paddingBottom: "14px" }}>
          <div>
            <div style={{ fontSize: "9px", letterSpacing: "0.3em", color: "#d4a574", textTransform: "uppercase", fontWeight: 500 }}>Holbox Dining · Panel</div>
            <h1 style={{ fontSize: "22px", fontFamily: "'Italiana', serif", fontWeight: 400, margin: "2px 0 0 0", letterSpacing: "0.02em" }}>{titulos[tab]}</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "13px", fontWeight: 600 }}>{perfil.nombre || perfil.email}</div>
              <div style={{ fontSize: "10px", color: "#d4a574", letterSpacing: "0.1em", textTransform: "uppercase" }}>{ROL_LABEL[perfil.rol] || perfil.rol}</div>
            </div>
            <button onClick={cerrarSesion} style={{ background: "transparent", border: "1px solid #d4a574", color: "#d4a574", padding: "8px 10px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
              <LogOut size={14} />
            </button>
          </div>
        </div>
        {/* TABS */}
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", gap: "4px", paddingBottom: "0" }}>
          <TabBtn active={tab === "hoy"} onClick={() => setTab("hoy")} icon={<Calendar size={13} />} label="Hoy" />
          {puedeVerValidaciones && <TabBtn active={tab === "validaciones"} onClick={() => setTab("validaciones")} icon={<ClipboardList size={13} />} label="Validaciones" badge={validaciones.length > 0 ? validaciones.length : null} />}
          {puedeVerHistorico && <TabBtn active={tab === "historico"} onClick={() => setTab("historico")} icon={<History size={13} />} label="Histórico" />}{perfil?.rol === 'admin' && <TabBtn active={tab === "comisiones"} onClick={() => setTab("comisiones")} icon={<DollarSign size={13} />} label="Comisiones" />}{perfil?.rol === 'admin' && <TabBtn active={tab === "reportes"} onClick={() => setTab("reportes")} icon={<Sparkles size={13} />} label="Reportes" />}
        </div>
      </header>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px 16px 60px" }}>

        {/* TAB: HOY */}
        {tab === "hoy" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#6b5d47", marginBottom: "16px", fontWeight: 500 }}>
              <Calendar size={15} />
              {new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              <button onClick={cargarReservas} style={{ marginLeft: "auto", background: "white", border: "1px solid #d4a574", color: "#8b6914", padding: "6px 10px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 500 }}>
                <RefreshCw size={13} /> Actualizar
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginBottom: "20px" }}>
              <StatCard label="Total" valor={stats.total} color="#1a3a2e" icon={<Sparkles size={14} />} />
              <StatCard label="Pendientes" valor={stats.pendientes} color="#c9962b" icon={<Clock size={14} />} />
              <StatCard label="Llegados" valor={stats.llegados} color="#2d7d46" icon={<CheckCircle2 size={14} />} />
              <StatCard label="No show" valor={stats.noShow} color="#c73e3a" icon={<XCircle size={14} />} />
              <StatCard label="Comensales" valor={stats.personas} color="#2c3e50" icon={<Users size={14} />} />
            </div>

            <div style={{ background: "white", padding: "14px 16px", borderRadius: "12px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
              <Filter size={15} color="#8b7355" />
              <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#8b7355", fontWeight: 600 }}>Filtros:</span>
              {mostrarFiltroRestaurante && (
                <select value={filtroRestaurante} onChange={(e) => setFiltroRestaurante(e.target.value)} style={selectStyle}>
                  <option value="todos">Todos los restaurantes</option>
                  <option value="el-nido">El Nido</option>
                  <option value="soulbox">Soulbox</option>
                  <option value="bocamar">Bocamar</option>
                  <option value="leonessa">Leonessa</option>
                </select>
              )}
              <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={selectStyle}>
                <option value="todos">Todos los estados</option>
                <option value="pendiente">Pendientes</option>
                <option value="confirmada">Confirmadas</option>
                <option value="llegado">Llegados</option>
                <option value="no_show">No show</option>
              </select>
            </div>

            {cargando ? <LoadingSpinner texto="Cargando reservas..." />
              : error ? <ErrorBox mensaje={error} />
              : reservasFiltradas.length === 0 ? <EmptyState reservas={reservas} />
              : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {reservasFiltradas.map((r) => (
                    <ReservaCard key={r.id} reserva={r}
                      onMarcarLlegado={() => cambiarEstado(r.id, "llegado")}
                      onMarcarNoShow={() => cambiarEstado(r.id, "no_show")}
                      onMarcarPendiente={() => cambiarEstado(r.id, "pendiente")}
                      onRegistrarConsumo={() => setModalConsumo(r)}
                      accionando={accionandoId === r.id}
                      perfil={perfil}
                    />
                  ))}
                </div>
              )}
          </>
        )}

        {/* TAB: VALIDACIONES */}
        {tab === "validaciones" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ fontSize: "13px", color: "#6b5d47", fontWeight: 500 }}>Comisiones pendientes de aprobación</div>
              <button onClick={cargarValidaciones} style={{ background: "white", border: "1px solid #d4a574", color: "#8b6914", padding: "6px 10px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 500 }}>
                <RefreshCw size={13} /> Actualizar
              </button>
            </div>
            {cargandoVal ? <LoadingSpinner texto="Cargando validaciones..." />
              : validaciones.length === 0 ? (
                <div style={{ background: "white", padding: "60px 20px", borderRadius: "12px", textAlign: "center", color: "#8b7355", border: "1px dashed #d4a574" }}>
                  <CheckCircle2 size={32} color="#2d7d46" style={{ marginBottom: "12px" }} />
                  <div style={{ fontSize: "16px", fontWeight: 500, color: "#2c2416" }}>Sin pendientes</div>
                  <div style={{ fontSize: "13px", marginTop: "4px" }}>Todas las comisiones están validadas</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {validaciones.map((r) => (
                    <ValidacionCard key={r.id} reserva={r}
                      onAprobar={() => validarComision(r.id, true)}
                      onRechazar={() => validarComision(r.id, false)}
                      accionando={accionandoId === r.id}
                      perfil={perfil}
                    />
                  ))}
                </div>
              )}
          </>
        )}

        
        {/* TAB: COMISIONES */}
{tab === "comisiones" && (
  <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "16px 0" }}>
    <CorteComisiones userRole={perfil?.rol} />
  </div>
)}

         {/* TAB: REPORTES */}
      {tab === "reportes" && (
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "16px 0" }}>
          <Reportes perfil={perfil} />
        </div>
      )}
        {tab === "historico" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
              <div style={{ fontSize: "13px", color: "#6b5d47", fontWeight: 500 }}>Semana:</div>
              <input type="week" value={semanaFiltro} onChange={(e) => setSemanaFiltro(e.target.value)} style={{ ...selectStyle, padding: "6px 10px" }} />
              <button onClick={cargarHistorico} style={{ background: "#1a1410", color: "#d4a574", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>
                Buscar
              </button>
            </div>

            {cargandoHist ? <LoadingSpinner texto="Cargando histórico..." />
              : historico.length === 0 ? (
                <div style={{ background: "white", padding: "60px 20px", borderRadius: "12px", textAlign: "center", color: "#8b7355", border: "1px dashed #d4a574" }}>
                  <History size={32} color="#d4a574" style={{ marginBottom: "12px" }} />
                  <div style={{ fontSize: "16px", fontWeight: 500, color: "#2c2416" }}>Sin comisiones aprobadas</div>
                  <div style={{ fontSize: "13px", marginTop: "4px" }}>Para la semana {semanaFiltro}</div>
                </div>
              ) : (
                <>
                  <div style={{ background: "#1a1410", color: "#f5ead8", borderRadius: "14px", padding: "20px 24px", marginBottom: "16px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
                    <div>
                      <div style={{ fontSize: "10px", letterSpacing: "0.2em", color: "#d4a574", textTransform: "uppercase", marginBottom: "4px" }}>Semana {semanaFiltro}</div>
                      <div style={{ fontSize: "30px", fontWeight: 700, color: "#d4a574" }}>
                        ${historico.reduce((s, r) => s + (r.comision_monto || 0), 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: "12px", color: "#c9b896", marginTop: "2px" }}>Total comisiones a pagar</div>
                    </div>
                    <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "24px", fontWeight: 700 }}>{historico.length}</div>
                        <div style={{ fontSize: "11px", color: "#c9b896" }}>Reservas</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "24px", fontWeight: 700 }}>
                          ${historico.reduce((s, r) => s + (r.consumo_subtotal || 0), 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: "11px", color: "#c9b896" }}>Consumo total</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {historico.map((r) => <HistoricoCard key={r.id} reserva={r} />)}
                  </div>
                </>
              )}
          </>
        )}
      </div>

      {modalConsumo && <ModalConsumo reserva={modalConsumo} onGuardar={registrarConsumo} onCerrar={() => setModalConsumo(null)} />}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } select,input { cursor: pointer; }`}</style>
    </div>
  );
}

function ModalConsumo({ reserva, onGuardar, onCerrar }) {
  const [subtotal, setSubtotal] = useState("");
  const [guardando, setGuardando] = useState(false);
  const info = RESTAURANTES_INFO[reserva.restaurante_id] || { nombre: reserva.restaurante_id };
  const comision = subtotal && parseFloat(subtotal) > 0 ? Math.round(parseFloat(subtotal) * 0.05 * 100) / 100 : 0;

  const handleGuardar = async () => {
    if (!subtotal || parseFloat(subtotal) <= 0) { alert("Ingresa un subtotal válido"); return; }
    setGuardando(true);
    await onGuardar(reserva.id, parseFloat(subtotal));
    setGuardando(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ background: "white", borderRadius: "18px", padding: "28px 24px", maxWidth: "400px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ fontSize: "10px", letterSpacing: "0.2em", color: "#d4a574", textTransform: "uppercase", marginBottom: "4px" }}>Registrar consumo</div>
        <h2 style={{ fontSize: "20px", fontFamily: "'Italiana', serif", fontWeight: 400, margin: "0 0 20px 0", color: "#2c2416" }}>{reserva.cliente_nombre}</h2>
        <div style={{ background: "#f5ead8", borderRadius: "10px", padding: "12px 14px", marginBottom: "20px", fontSize: "13px", color: "#6b5d47" }}>
          <div style={{ fontWeight: 600, color: "#2c2416", marginBottom: "4px" }}>{info.nombre} · {(reserva.hora || "").slice(0, 5)}</div>
          <div>🎫 {reserva.codigo_referidor} · {reserva.personas} personas</div>
        </div>
        <label style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#8b7355", fontWeight: 600, display: "block", marginBottom: "8px" }}>
          Subtotal antes de IVA (MXN)
        </label>
        <input
          type="number" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} placeholder="Ej: 850.00" autoFocus
          style={{ width: "100%", padding: "12px 14px", border: "2px solid #d4c5a0", borderRadius: "10px", fontSize: "20px", fontWeight: 600, color: "#2c2416", outline: "none", boxSizing: "border-box", fontFamily: "'Inter', sans-serif" }}
        />
        {comision > 0 && (
          <div style={{ background: "#1a1410", color: "#f5ead8", borderRadius: "10px", padding: "14px 16px", marginTop: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: "#d4a574", textTransform: "uppercase" }}>Comisión 5%</div>
              <div style={{ fontSize: "26px", fontWeight: 700, color: "#d4a574" }}>${comision.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</div>
            </div>
            <DollarSign size={28} color="#d4a574" opacity={0.5} />
          </div>
        )}
        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <button onClick={onCerrar} style={{ flex: 1, background: "#f0ece4", color: "#6b5d47", border: "none", padding: "12px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={guardando || !subtotal || parseFloat(subtotal) <= 0}
            style={{ flex: 2, background: guardando || !subtotal ? "#ccc" : "#2d7d46", color: "white", border: "none", padding: "12px", borderRadius: "10px", fontSize: "13px", fontWeight: 700, cursor: guardando ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
            {guardando ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle2 size={16} />}
            {guardando ? "Guardando..." : "Registrar comisión"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ValidacionCard({ reserva, onAprobar, onRechazar, accionando, perfil }) {
  const info = RESTAURANTES_INFO[reserva.restaurante_id] || { nombre: reserva.restaurante_id, color: "#8b7355" };
  const puedeValidar = ["admin", "validador"].includes(perfil.rol);
  return (
    <div style={{ background: "white", borderRadius: "14px", padding: "16px 18px", boxShadow: "0 2px 14px rgba(0,0,0,0.05)", borderLeft: `5px solid ${info.color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
        <div>
          <div style={{ fontSize: "16px", fontWeight: 600, color: "#2c2416", marginBottom: "2px" }}>{reserva.cliente_nombre}</div>
          <div style={{ fontSize: "12px", color: "#8b7355" }}>
            {info.nombre} · {new Date(reserva.fecha + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })} · 🎫 {reserva.codigo_referidor}
          </div>
        </div>
        <div style={{ background: "#fef3e0", color: "#c9962b", fontSize: "10px", padding: "4px 10px", borderRadius: "100px", fontWeight: 700, textTransform: "uppercase", border: "1px solid #c9962b40" }}>Pendiente</div>
      </div>
      <div style={{ display: "flex", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
        <div style={{ background: "#f5ead8", borderRadius: "8px", padding: "10px 14px", flex: 1, minWidth: "100px" }}>
          <div style={{ fontSize: "10px", color: "#8b7355", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2px" }}>Consumo</div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#2c2416" }}>${(reserva.consumo_subtotal || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</div>
        </div>
        <div style={{ background: "#1a1410", borderRadius: "8px", padding: "10px 14px", flex: 1, minWidth: "100px" }}>
          <div style={{ fontSize: "10px", color: "#d4a574", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2px" }}>Comisión 5%</div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#d4a574" }}>${(reserva.comision_monto || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</div>
        </div>
      </div>
      <div style={{ fontSize: "11px", color: "#8b7355", marginBottom: "12px" }}>
        Registrado por {reserva.consumo_registrado_por} · {reserva.consumo_registrado_at ? new Date(reserva.consumo_registrado_at).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
      </div>
      {puedeValidar && (
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={onRechazar} disabled={accionando} style={{ flex: 1, background: "#fdecea", color: "#c73e3a", border: "1px solid #c73e3a40", padding: "10px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: accionando ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <XCircle size={14} /> Rechazar
          </button>
          <button onClick={onAprobar} disabled={accionando} style={{ flex: 2, background: "#2d7d46", color: "white", border: "none", padding: "10px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: accionando ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <CheckCircle2 size={14} /> Aprobar comisión
          </button>
        </div>
      )}
    </div>
  );
}

function HistoricoCard({ reserva }) {
  const info = RESTAURANTES_INFO[reserva.restaurante_id] || { nombre: reserva.restaurante_id, color: "#8b7355" };
  return (
    <div style={{ background: "white", borderRadius: "12px", padding: "14px 16px", boxShadow: "0 2px 10px rgba(0,0,0,0.04)", borderLeft: `4px solid ${info.color}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
      <div>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "#2c2416" }}>{reserva.cliente_nombre}</div>
        <div style={{ fontSize: "12px", color: "#8b7355", marginTop: "2px" }}>
          {info.nombre} · 🎫 {reserva.codigo_referidor} · {new Date(reserva.fecha + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
        </div>
        <div style={{ fontSize: "11px", color: "#a09080", marginTop: "2px" }}>Validado por {reserva.validado_por}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "11px", color: "#8b7355", textTransform: "uppercase", letterSpacing: "0.1em" }}>Comisión</div>
        <div style={{ fontSize: "20px", fontWeight: 700, color: "#2d7d46" }}>${(reserva.comision_monto || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</div>
        <div style={{ fontSize: "11px", color: "#a09080" }}>de ${(reserva.consumo_subtotal || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label, badge }) {
  return (
    <button onClick={onClick} style={{ background: active ? "#d4a574" : "transparent", color: active ? "#1a1410" : "#d4a574", border: `1px solid #d4a574`, padding: "7px 14px", borderRadius: "8px 8px 0 0", cursor: "pointer", fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px", position: "relative" }}>
      {icon} {label}
      {badge && <span style={{ background: "#c73e3a", color: "white", borderRadius: "100px", fontSize: "10px", padding: "1px 6px", fontWeight: 700 }}>{badge}</span>}
    </button>
  );
}

function LoadingSpinner({ texto }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "#8b7355" }}>
      <Loader2 size={28} style={{ animation: "spin 1s linear infinite", marginBottom: "10px" }} />
      <div style={{ fontSize: "13px" }}>{texto}</div>
    </div>
  );
}

function ErrorBox({ mensaje }) {
  return <div style={{ background: "#fdecea", border: "1px solid #f5c2c7", color: "#842029", padding: "16px", borderRadius: "10px", fontSize: "13px" }}>Error: {mensaje}</div>;
}

function EmptyState({ reservas }) {
  return (
    <div style={{ background: "white", padding: "60px 20px", borderRadius: "12px", textAlign: "center", color: "#8b7355", border: "1px dashed #d4a574" }}>
      <Sparkles size={32} color="#d4a574" style={{ marginBottom: "12px" }} />
      <div style={{ fontSize: "16px", fontWeight: 500, marginBottom: "4px", color: "#2c2416" }}>Sin reservas por ahora</div>
      <div style={{ fontSize: "13px" }}>{reservas.length > 0 ? "Ajusta los filtros para ver más" : "Las reservas del día aparecerán aquí"}</div>
    </div>
  );
}

function StatCard({ label, valor, color, icon }) {
  return (
    <div style={{ background: "white", padding: "12px 14px", borderRadius: "12px", borderLeft: `4px solid ${color}`, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#8b7355", fontWeight: 600, marginBottom: "4px" }}>{icon} {label}</div>
      <div style={{ fontSize: "26px", fontWeight: 700, color: color, lineHeight: 1 }}>{valor}</div>
    </div>
  );
}

function ReservaCard({ reserva, onMarcarLlegado, onMarcarNoShow, onMarcarPendiente, onRegistrarConsumo, accionando, perfil }) {
  const info = RESTAURANTES_INFO[reserva.restaurante_id] || { nombre: reserva.restaurante_id, color: "#8b7355" };
  const estadoInfo = ESTADO_INFO[reserva.estado] || { label: reserva.estado, color: "#8b7355", bg: "#f0ece4" };
  const puedeActuar = ["hostess", "fb_manager", "admin"].includes(perfil.rol);
  const estadoFinal = reserva.estado === "llegado" || reserva.estado === "no_show";
  const puedeRegistrarConsumo = ["fb_manager", "admin"].includes(perfil.rol) && reserva.estado === "llegado" && !reserva.consumo_subtotal;

  return (
    <div style={{ background: "white", borderRadius: "14px", padding: "16px 18px", boxShadow: "0 2px 14px rgba(0,0,0,0.05)", borderLeft: `5px solid ${info.color}`, opacity: reserva.estado === "no_show" ? 0.65 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ background: info.color, color: "white", fontSize: "10px", letterSpacing: "0.1em", padding: "4px 10px", borderRadius: "100px", fontWeight: 700, textTransform: "uppercase" }}>{info.nombre}</div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "14px", fontWeight: 600, color: "#2c2416" }}><Clock size={14} color="#8b7355" /> {(reserva.hora || "").slice(0, 5)}</div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "#6b5d47" }}><Users size={13} /> {reserva.personas}</div>
        </div>
        <div style={{ background: estadoInfo.bg, color: estadoInfo.color, fontSize: "10px", letterSpacing: "0.08em", padding: "5px 11px", borderRadius: "100px", fontWeight: 700, textTransform: "uppercase", border: `1px solid ${estadoInfo.color}40` }}>
          {estadoInfo.label}
        </div>
      </div>
      <div style={{ marginBottom: "10px" }}>
        <div style={{ fontSize: "17px", fontWeight: 600, color: "#2c2416", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}><User size={15} color="#8b7355" /> {reserva.cliente_nombre}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "12px", color: "#6b5d47" }}>
          {reserva.cliente_telefono && <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Phone size={12} /> {reserva.cliente_telefono}</span>}
          {reserva.cliente_hotel && <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Hotel size={12} /> {reserva.cliente_hotel}</span>}
          <span style={{ display: "flex", alignItems: "center", gap: "4px", background: "#f5ead8", padding: "2px 8px", borderRadius: "6px", fontWeight: 600, color: "#8b6914" }}>🎫 {reserva.codigo_referidor}</span>
        </div>
        {reserva.notas && (
          <div style={{ marginTop: "8px", padding: "8px 10px", background: "#faf6f0", borderRadius: "8px", fontSize: "12px", color: "#6b5d47", display: "flex", gap: "6px", alignItems: "flex-start" }}>
            <MessageSquare size={12} style={{ marginTop: "2px", flexShrink: 0 }} /> {reserva.notas}
          </div>
        )}
        {reserva.consumo_subtotal && (
          <div style={{ marginTop: "8px", padding: "8px 12px", background: "#dff5e3", borderRadius: "8px", fontSize: "12px", color: "#2d7d46", display: "flex", gap: "8px", alignItems: "center", fontWeight: 600, flexWrap: "wrap" }}>
            <DollarSign size={13} />
            Consumo: ${reserva.consumo_subtotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })} · Comisión: ${reserva.comision_monto?.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            <span style={{ marginLeft: "auto", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", color: reserva.validacion_estado === "aprobada" ? "#2d7d46" : reserva.validacion_estado === "rechazada" ? "#c73e3a" : "#c9962b" }}>
              {reserva.validacion_estado === "aprobada" ? "✓ Aprobada" : reserva.validacion_estado === "rechazada" ? "✗ Rechazada" : "⏳ Pendiente"}
            </span>
          </div>
        )}
      </div>
      {puedeActuar && (
        <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
          {!estadoFinal ? (
            <>
              <button onClick={onMarcarLlegado} disabled={accionando} style={{ flex: 1, minWidth: "130px", background: "#2d7d46", color: "white", border: "none", padding: "10px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: accionando ? "not-allowed" : "pointer", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", opacity: accionando ? 0.6 : 1 }}>
                <CheckCircle2 size={14} /> Llegó
              </button>
              <button onClick={onMarcarNoShow} disabled={accionando} style={{ flex: 1, minWidth: "130px", background: "#c73e3a", color: "white", border: "none", padding: "10px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: accionando ? "not-allowed" : "pointer", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", opacity: accionando ? 0.6 : 1 }}>
                <XCircle size={14} /> No show
              </button>
            </>
          ) : (
            <div style={{ display: "flex", gap: "8px", width: "100%", flexWrap: "wrap" }}>
              <button onClick={onMarcarPendiente} disabled={accionando} style={{ background: "#f0ece4", color: "#6b5d47", border: "1px solid #d4c5a0", padding: "8px 14px", borderRadius: "8px", fontSize: "11px", fontWeight: 600, cursor: accionando ? "not-allowed" : "pointer", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Deshacer
              </button>
              {puedeRegistrarConsumo && (
                <button onClick={onRegistrarConsumo} style={{ flex: 1, background: "#1a1410", color: "#d4a574", border: "none", padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <DollarSign size={13} /> Registrar consumo
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ESTADO_INFO = {
  pendiente: { label: "Pendiente", color: "#c9962b", bg: "#fef3e0" },
  confirmada: { label: "Confirmada", color: "#2c3e50", bg: "#e3eaf2" },
  llegado: { label: "Llegado", color: "#2d7d46", bg: "#dff5e3" },
  no_show: { label: "No show", color: "#c73e3a", bg: "#fdecea" },
  cancelada: { label: "Cancelada", color: "#6b5d47", bg: "#f0ece4" },
};

const selectStyle = {
  padding: "8px 12px", border: "1px solid #d4c5a0", borderRadius: "8px",
  fontFamily: "'Inter', sans-serif", fontSize: "12px", background: "white",
  color: "#2c2416", outline: "none", fontWeight: 500,
};
