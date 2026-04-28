import { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase";
import {
  UserPlus, Search, Hotel, Phone, Mail, Copy, Check, X,
  Loader2, RefreshCw, Power, Edit2, Save, AlertCircle, Sparkles
} from "lucide-react";

export default function Referidores({ perfil }) {
  const [hoteles, setHoteles] = useState([]);
  const [referidores, setReferidores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroHotel, setFiltroHotel] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("activos");
  const [editandoId, setEditandoId] = useState(null);
  const [accionandoId, setAccionandoId] = useState(null);
  const [codigoRecien, setCodigoRecien] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);
    const [h, r] = await Promise.all([
      supabase.from("fuentes_referencia").select("id, nombre, numero_hotel, zona").order("numero_hotel"),
      supabase.from("referidores").select("*").order("codigo"),
    ]);
    if (h.error) { setError(h.error.message); setCargando(false); return; }
    if (r.error) { setError(r.error.message); setCargando(false); return; }
    setHoteles(h.data || []);
    setReferidores(r.data || []);
    setCargando(false);
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const referidoresFiltrados = referidores.filter((r) => {
    if (filtroEstado === "activos" && !r.activo) return false;
    if (filtroEstado === "inactivos" && r.activo) return false;
    if (filtroHotel !== "todos" && r.fuente_id !== filtroHotel) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      const hotelNombre = hoteles.find((h) => h.id === r.fuente_id)?.nombre?.toLowerCase() || "";
      if (
        !r.nombre?.toLowerCase().includes(q) &&
        !r.codigo?.toLowerCase().includes(q) &&
        !hotelNombre.includes(q) &&
        !r.whatsapp?.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const stats = {
    total: referidores.filter((r) => r.activo).length,
    inactivos: referidores.filter((r) => !r.activo).length,
    hoteles: new Set(referidores.filter((r) => r.activo).map((r) => r.fuente_id)).size,
    sinCodigo: referidores.filter((r) => r.activo && !/^\d{6}$/.test(r.codigo || "")).length,
  };

  const desactivar = async (id, activoActual) => {
    const accion = activoActual ? "desactivar" : "reactivar";
    if (!confirm(`¿Confirmas ${accion} este referidor?`)) return;
    setAccionandoId(id);
    const { error } = await supabase.from("referidores").update({ activo: !activoActual }).eq("id", id);
    setAccionandoId(null);
    if (error) { alert("Error: " + error.message); return; }
    cargarDatos();
  };

  const copiarCodigo = (codigo) => {
    navigator.clipboard.writeText(codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  };

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ fontSize: "13px", color: "#6b5d47", fontWeight: 500 }}>
          {stats.total} referidores activos en {stats.hoteles} hoteles
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={cargarDatos} style={{ background: "white", border: "1px solid #d4a574", color: "#8b6914", padding: "6px 10px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 500 }}>
            <RefreshCw size={13} /> Actualizar
          </button>
          <button onClick={() => setMostrarFormulario(true)} style={{ background: "#1a1410", color: "#d4a574", border: "none", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <UserPlus size={14} /> Nuevo referidor
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginBottom: "20px" }}>
        <StatBox label="Activos" valor={stats.total} color="#2d7d46" />
        <StatBox label="Hoteles cubiertos" valor={`${stats.hoteles} / ${hoteles.length}`} color="#1a3a2e" />
        <StatBox label="Inactivos" valor={stats.inactivos} color="#8b7355" />
      </div>

      {/* Filtros */}
      <div style={{ background: "white", padding: "14px 16px", borderRadius: "12px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <Search size={15} color="#8b7355" />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, código, hotel, WhatsApp..."
          style={{ flex: 1, minWidth: "200px", padding: "8px 12px", border: "1px solid #d4c5a0", borderRadius: "8px", fontSize: "13px", color: "#2c2416", outline: "none", fontFamily: "'Inter', sans-serif" }}
        />
        <select value={filtroHotel} onChange={(e) => setFiltroHotel(e.target.value)} style={selectStyleLocal}>
          <option value="todos">Todos los hoteles</option>
          {hoteles.map((h) => (
            <option key={h.id} value={h.id}>{String(h.numero_hotel).padStart(4, "0")} · {h.nombre}</option>
          ))}
        </select>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={selectStyleLocal}>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
          <option value="todos">Todos</option>
        </select>
      </div>

      {/* Listado */}
      {cargando ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#8b7355" }}>
          <Loader2 size={28} style={{ animation: "spin 1s linear infinite", marginBottom: "10px" }} />
          <div style={{ fontSize: "13px" }}>Cargando referidores...</div>
        </div>
      ) : error ? (
        <div style={{ background: "#fdecea", border: "1px solid #f5c2c7", color: "#842029", padding: "16px", borderRadius: "10px", fontSize: "13px" }}>
          Error: {error}
        </div>
      ) : referidoresFiltrados.length === 0 ? (
        <div style={{ background: "white", padding: "60px 20px", borderRadius: "12px", textAlign: "center", color: "#8b7355", border: "1px dashed #d4a574" }}>
          <Sparkles size={32} color="#d4a574" style={{ marginBottom: "12px" }} />
          <div style={{ fontSize: "16px", fontWeight: 500, marginBottom: "4px", color: "#2c2416" }}>
            {referidores.length === 0 ? "Aún no hay referidores" : "Sin resultados"}
          </div>
          <div style={{ fontSize: "13px" }}>
            {referidores.length === 0 ? 'Da de alta el primer receptionista con "Nuevo referidor"' : "Ajusta los filtros o búsqueda"}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {referidoresFiltrados.map((r) => {
            const hotel = hoteles.find((h) => h.id === r.fuente_id);
            return (
              <ReferidorCard
                key={r.id}
                referidor={r}
                hotel={hotel}
                editando={editandoId === r.id}
                accionando={accionandoId === r.id}
                onEditar={() => setEditandoId(r.id)}
                onCancelarEdit={() => setEditandoId(null)}
                onGuardado={() => { setEditandoId(null); cargarDatos(); }}
                onDesactivar={() => desactivar(r.id, r.activo)}
                onCopiar={copiarCodigo}
                copiado={copiado}
              />
            );
          })}
        </div>
      )}

      {/* Modal de alta */}
      {mostrarFormulario && (
        <ModalAlta
          hoteles={hoteles}
          perfil={perfil}
          onCerrar={() => setMostrarFormulario(false)}
          onCreado={(codigo) => {
            setMostrarFormulario(false);
            setCodigoRecien(codigo);
            cargarDatos();
          }}
        />
      )}

      {/* Modal de código generado */}
      {codigoRecien && (
        <ModalCodigoGenerado
          codigo={codigoRecien}
          onCerrar={() => setCodigoRecien(null)}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ============================================================
// CARD DE REFERIDOR
// ============================================================
function ReferidorCard({ referidor, hotel, editando, accionando, onEditar, onCancelarEdit, onGuardado, onDesactivar, onCopiar, copiado }) {
  const [nombre, setNombre] = useState(referidor.nombre || "");
  const [puesto, setPuesto] = useState(referidor.puesto || "Recepcionista");
  const [whatsapp, setWhatsapp] = useState(referidor.whatsapp || "");
  const [email, setEmail] = useState(referidor.email || "");
  const [notas, setNotas] = useState(referidor.notas || "");
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!nombre.trim()) { alert("El nombre no puede estar vacío"); return; }
    setGuardando(true);
    const { error } = await supabase.from("referidores").update({
      nombre: nombre.trim(),
      puesto: puesto.trim() || "Recepcionista",
      whatsapp: whatsapp.trim() || null,
      email: email.trim() || null,
      notas: notas.trim() || null,
    }).eq("id", referidor.id);
    setGuardando(false);
    if (error) { alert("Error: " + error.message); return; }
    onGuardado();
  };

  const codigoValido = /^\d{6}$/.test(referidor.codigo || "");

  return (
    <div style={{ background: "white", borderRadius: "14px", padding: "16px 18px", boxShadow: "0 2px 14px rgba(0,0,0,0.05)", borderLeft: `5px solid ${referidor.activo ? "#2d7d46" : "#8b7355"}`, opacity: referidor.activo ? 1 : 0.65 }}>
      {/* Línea superior: código + hotel + estado */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={() => onCopiar(referidor.codigo)}
            disabled={!codigoValido}
            style={{
              background: codigoValido ? "#1a1410" : "#f0ece4",
              color: codigoValido ? "#d4a574" : "#8b7355",
              border: "none",
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 700,
              fontFamily: "'Courier New', monospace",
              letterSpacing: "0.1em",
              cursor: codigoValido ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            🎫 {referidor.codigo}
            {codigoValido && (copiado ? <Check size={12} /> : <Copy size={12} />)}
          </button>
          {hotel && (
            <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#6b5d47" }}>
              <Hotel size={13} /> {hotel.nombre}
              {hotel.zona && <span style={{ fontSize: "11px", color: "#a09080" }}>· {hotel.zona}</span>}
            </span>
          )}
        </div>
        <div style={{
          background: referidor.activo ? "#dff5e3" : "#f0ece4",
          color: referidor.activo ? "#2d7d46" : "#8b7355",
          fontSize: "10px",
          padding: "4px 10px",
          borderRadius: "100px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          border: `1px solid ${referidor.activo ? "#2d7d46" : "#8b7355"}40`
        }}>
          {referidor.activo ? "Activo" : "Inactivo"}
        </div>
      </div>

      {/* Datos del referidor */}
      {editando ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", marginBottom: "12px" }}>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre completo" style={inputEditStyle} autoFocus />
          <input value={puesto} onChange={(e) => setPuesto(e.target.value)} placeholder="Puesto" style={inputEditStyle} />
          <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp" style={inputEditStyle} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={inputEditStyle} />
          <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas" style={{ ...inputEditStyle, gridColumn: "1 / -1" }} />
        </div>
      ) : (
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "16px", fontWeight: 600, color: "#2c2416", marginBottom: "4px" }}>
            {referidor.nombre} <span style={{ fontSize: "12px", color: "#8b7355", fontWeight: 400 }}>· {referidor.puesto || "Recepcionista"}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "12px", color: "#6b5d47" }}>
            {referidor.whatsapp && (
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Phone size={12} /> {referidor.whatsapp}
              </span>
            )}
            {referidor.email && (
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Mail size={12} /> {referidor.email}
              </span>
            )}
          </div>
          {referidor.notas && (
            <div style={{ marginTop: "8px", padding: "8px 10px", background: "#faf6f0", borderRadius: "8px", fontSize: "12px", color: "#6b5d47" }}>
              {referidor.notas}
            </div>
          )}
        </div>
      )}

      {/* Acciones */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {editando ? (
          <>
            <button onClick={onCancelarEdit} disabled={guardando} style={{ flex: 1, background: "#f0ece4", color: "#6b5d47", border: "none", padding: "10px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: guardando ? "not-allowed" : "pointer", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Cancelar
            </button>
            <button onClick={guardar} disabled={guardando} style={{ flex: 2, background: guardando ? "#999" : "#2d7d46", color: "white", border: "none", padding: "10px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, cursor: guardando ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {guardando ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
              {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
          </>
        ) : (
          <>
            <button onClick={onEditar} disabled={accionando} style={{ background: "white", color: "#8b6914", border: "1px solid #d4a574", padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: accionando ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
              <Edit2 size={13} /> Editar
            </button>
            <button onClick={onDesactivar} disabled={accionando} style={{ background: referidor.activo ? "#fdecea" : "#dff5e3", color: referidor.activo ? "#c73e3a" : "#2d7d46", border: `1px solid ${referidor.activo ? "#c73e3a40" : "#2d7d4640"}`, padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: accionando ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
              <Power size={13} /> {referidor.activo ? "Desactivar" : "Reactivar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MODAL ALTA NUEVO REFERIDOR
// ============================================================
function ModalAlta({ hoteles, perfil, onCerrar, onCreado }) {
  const [hotelId, setHotelId] = useState("");
  const [nombre, setNombre] = useState("");
  const [puesto, setPuesto] = useState("Recepcionista");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const guardar = async () => {
    setErrorMsg(null);
    if (!hotelId) { setErrorMsg("Selecciona un hotel"); return; }
    if (!nombre.trim()) { setErrorMsg("El nombre es obligatorio"); return; }
    setGuardando(true);
    // 1. Generar código
    const { data: codigoData, error: codigoError } = await supabase.rpc("generar_codigo_referidor", { p_fuente_id: hotelId });
    if (codigoError) {
      setErrorMsg("Error generando código: " + codigoError.message);
      setGuardando(false);
      return;
    }
    // 2. Insertar referidor
    const { error: insertError } = await supabase.from("referidores").insert({
      codigo: codigoData,
      nombre: nombre.trim(),
      puesto: puesto.trim() || "Recepcionista",
      fuente_id: hotelId,
      whatsapp: whatsapp.trim() || null,
      email: email.trim() || null,
      notas: notas.trim() || null,
      activo: true,
      tipo_referidor: "recepcionista",
      dado_alta_por: perfil?.email || null,
    });
    setGuardando(false);
    if (insertError) {
      setErrorMsg("Error al guardar: " + insertError.message);
      return;
    }
    onCreado(codigoData);
  };

  const hotelSeleccionado = hoteles.find((h) => h.id === hotelId);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ background: "white", borderRadius: "18px", padding: "28px 24px", maxWidth: "480px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
          <div>
            <div style={{ fontSize: "10px", letterSpacing: "0.2em", color: "#d4a574", textTransform: "uppercase", marginBottom: "4px" }}>Nuevo referidor</div>
            <h2 style={{ fontSize: "20px", fontFamily: "'Italiana', serif", fontWeight: 400, margin: 0, color: "#2c2416" }}>Alta de receptionista</h2>
          </div>
          <button onClick={onCerrar} style={{ background: "none", border: "none", color: "#8b7355", cursor: "pointer", padding: "4px" }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <FormField label="Hotel *">
            <select value={hotelId} onChange={(e) => setHotelId(e.target.value)} style={inputModalStyle}>
              <option value="">— Selecciona hotel —</option>
              {hoteles.map((h) => (
                <option key={h.id} value={h.id}>
                  {String(h.numero_hotel).padStart(4, "0")} · {h.nombre}
                </option>
              ))}
            </select>
          </FormField>

          {hotelSeleccionado && (
            <div style={{ background: "#f5ead8", borderRadius: "8px", padding: "10px 12px", fontSize: "12px", color: "#8b6914", display: "flex", alignItems: "center", gap: "6px" }}>
              <AlertCircle size={14} />
              El código se generará automáticamente al guardar (formato: {String(hotelSeleccionado.numero_hotel).padStart(4, "0")}XX)
            </div>
          )}

          <FormField label="Nombre completo *">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: María González" style={inputModalStyle} autoFocus />
          </FormField>

          <FormField label="Puesto">
            <input value={puesto} onChange={(e) => setPuesto(e.target.value)} placeholder="Recepcionista" style={inputModalStyle} />
          </FormField>

          <FormField label="WhatsApp">
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="9842043689" style={inputModalStyle} />
          </FormField>

          <FormField label="Email (opcional)">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@ejemplo.com" type="email" style={inputModalStyle} />
          </FormField>

          <FormField label="Notas (opcional)">
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Turno, idioma que habla, etc." rows={2} style={{ ...inputModalStyle, resize: "vertical", fontFamily: "'Inter', sans-serif" }} />
          </FormField>

          {errorMsg && (
            <div style={{ background: "#fdecea", border: "1px solid #f5c2c7", color: "#842029", padding: "10px 12px", borderRadius: "8px", fontSize: "12px" }}>
              {errorMsg}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
            <button onClick={onCerrar} disabled={guardando} style={{ flex: 1, background: "#f0ece4", color: "#6b5d47", border: "none", padding: "12px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, cursor: guardando ? "not-allowed" : "pointer" }}>
              Cancelar
            </button>
            <button onClick={guardar} disabled={guardando || !hotelId || !nombre.trim()} style={{ flex: 2, background: guardando || !hotelId || !nombre.trim() ? "#ccc" : "#1a1410", color: guardando || !hotelId || !nombre.trim() ? "#999" : "#d4a574", border: "none", padding: "12px", borderRadius: "10px", fontSize: "13px", fontWeight: 700, cursor: guardando || !hotelId || !nombre.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {guardando ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <UserPlus size={14} />}
              {guardando ? "Generando..." : "Crear referidor"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MODAL CÓDIGO GENERADO (después de crear)
// ============================================================
function ModalCodigoGenerado({ codigo, onCerrar }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = () => {
    navigator.clipboard.writeText(codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ background: "white", borderRadius: "18px", padding: "32px 28px", maxWidth: "440px", width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ background: "#dff5e3", color: "#2d7d46", width: "60px", height: "60px", borderRadius: "100px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Check size={32} />
        </div>
        <div style={{ fontSize: "10px", letterSpacing: "0.2em", color: "#d4a574", textTransform: "uppercase", marginBottom: "4px" }}>Referidor creado</div>
        <h2 style={{ fontSize: "20px", fontFamily: "'Italiana', serif", fontWeight: 400, margin: "0 0 6px 0", color: "#2c2416" }}>Código generado</h2>
        <div style={{ fontSize: "12px", color: "#8b7355", marginBottom: "20px" }}>
          Comparte este código con el receptionista para que lo dicte a sus huéspedes
        </div>
        <div style={{ background: "#1a1410", borderRadius: "14px", padding: "24px 16px", marginBottom: "16px" }}>
          <div style={{
            fontSize: "48px",
            fontWeight: 700,
            color: "#d4a574",
            fontFamily: "'Courier New', monospace",
            letterSpacing: "0.15em",
            marginBottom: "8px"
          }}>
            {codigo}
          </div>
          <button onClick={copiar} style={{ background: "transparent", border: `1px solid ${copiado ? "#2d7d46" : "#d4a574"}`, color: copiado ? "#2d7d46" : "#d4a574", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {copiado ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar código</>}
          </button>
        </div>
        <button onClick={onCerrar} style={{ background: "#1a1410", color: "#d4a574", border: "none", padding: "12px 24px", borderRadius: "10px", fontSize: "13px", fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em", width: "100%" }}>
          Listo
        </button>
      </div>
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================
function FormField({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#8b7355", fontWeight: 600, display: "block", marginBottom: "6px" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function StatBox({ label, valor, color }) {
  return (
    <div style={{ background: "white", padding: "12px 14px", borderRadius: "12px", borderLeft: `4px solid ${color}`, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
      <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#8b7355", fontWeight: 600, marginBottom: "4px" }}>
        {label}
      </div>
      <div style={{ fontSize: "26px", fontWeight: 700, color: color, lineHeight: 1 }}>
        {valor}
      </div>
    </div>
  );
}

const selectStyleLocal = {
  padding: "8px 12px", border: "1px solid #d4c5a0", borderRadius: "8px",
  fontFamily: "'Inter', sans-serif", fontSize: "12px", background: "white",
  color: "#2c2416", outline: "none", fontWeight: 500, cursor: "pointer"
};

const inputModalStyle = {
  width: "100%", padding: "10px 12px", border: "1px solid #d4c5a0", borderRadius: "8px",
  fontSize: "13px", color: "#2c2416", outline: "none", boxSizing: "border-box",
  fontFamily: "'Inter', sans-serif", background: "white"
};

const inputEditStyle = {
  padding: "8px 10px", border: "1px solid #d4c5a0", borderRadius: "8px",
  fontSize: "13px", color: "#2c2416", outline: "none",
  fontFamily: "'Inter', sans-serif", background: "white"
};
