import { useState, useEffect, useCallback } from "react";
import {
  LogOut, Calendar, Users, Clock, Phone, Hotel, MessageSquare,
  CheckCircle2, XCircle, Loader2, RefreshCw, Filter, User, Sparkles
} from "lucide-react";
import { supabase, RESTAURANTES_INFO } from "../lib/supabase";

const ROL_LABEL = {
  admin: "Administrador",
  fb_manager: "F&B Manager",
  hostess: "Hostess",
  validador: "Validador",
};

export default function Dashboard({ perfil, onLogout }) {
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtroRestaurante, setFiltroRestaurante] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [accionandoId, setAccionandoId] = useState(null);

  // Fecha de hoy en formato YYYY-MM-DD
  const hoy = new Date().toISOString().split("T")[0];

  const cargarReservas = useCallback(async () => {
    setCargando(true);
    setError(null);

    let query = supabase
      .from("reservas")
      .select("*")
      .eq("fecha", hoy)
      .order("hora", { ascending: true });

    // Si es hostess, solo ver reservas de su restaurante asignado
    if (perfil.rol === "hostess" && perfil.restaurante_asignado) {
      query = query.eq("restaurante_id", perfil.restaurante_asignado);
    }

    const { data, error: queryError } = await query;

    if (queryError) {
      console.error("Error al cargar reservas:", queryError);
      setError(queryError.message);
      setCargando(false);
      return;
    }

    setReservas(data || []);
    setCargando(false);
  }, [hoy, perfil.rol, perfil.restaurante_asignado]);

  useEffect(() => {
    cargarReservas();
  }, [cargarReservas]);

  // Realtime: escuchar cambios en la tabla reservas
  useEffect(() => {
    const canal = supabase
      .channel("reservas-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservas" },
        () => {
          cargarReservas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [cargarReservas]);

  const cambiarEstado = async (reservaId, nuevoEstado) => {
    setAccionandoId(reservaId);
    const actualizacion = {
      estado: nuevoEstado,
      updated_at: new Date().toISOString(),
    };

    if (nuevoEstado === "llegado" || nuevoEstado === "no_show") {
      actualizacion.marcado_llegado_por = perfil.email;
      actualizacion.marcado_llegado_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("reservas")
      .update(actualizacion)
      .eq("id", reservaId);

    setAccionandoId(null);

    if (updateError) {
      alert("Error al actualizar: " + updateError.message);
      return;
    }

    // Recargar manualmente por si realtime está desactivado
    cargarReservas();
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    if (onLogout) onLogout();
  };

  // Filtrar reservas según filtros activos
  const reservasFiltradas = reservas.filter((r) => {
    if (filtroRestaurante !== "todos" && r.restaurante_id !== filtroRestaurante) return false;
    if (filtroEstado !== "todos" && r.estado !== filtroEstado) return false;
    return true;
  });

  // Contadores del día
  const stats = {
    total: reservas.length,
    pendientes: reservas.filter((r) => r.estado === "pendiente" || r.estado === "confirmada").length,
    llegados: reservas.filter((r) => r.estado === "llegado").length,
    noShow: reservas.filter((r) => r.estado === "no_show").length,
    personas: reservas.reduce((sum, r) => sum + (r.personas || 0), 0),
  };

  // Hostess solo ve su restaurante — ocultamos el filtro de restaurante
  const mostrarFiltroRestaurante = perfil.rol !== "hostess";

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #f5ead8 0%, #ebdcc0 100%)",
      fontFamily: "'Inter', -apple-system, sans-serif",
      color: "#2c2416",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&family=Italiana&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <header style={{
        background: "#1a1410",
        color: "#f5ead8",
        padding: "18px 20px",
        borderBottom: "2px solid #d4a574",
        position: "sticky",
        top: 0,
        zIndex: 10,
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      }}>
        <div style={{
          maxWidth: "1100px",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}>
          <div>
            <div style={{
              fontSize: "9px",
              letterSpacing: "0.3em",
              color: "#d4a574",
              textTransform: "uppercase",
              fontWeight: 500,
            }}>
              Holbox Dining · Panel
            </div>
            <h1 style={{
              fontSize: "22px",
              fontFamily: "'Italiana', serif",
              fontWeight: 400,
              margin: "2px 0 0 0",
              letterSpacing: "0.02em",
            }}>
              Reservaciones de hoy
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "13px", fontWeight: 600 }}>
                {perfil.nombre || perfil.email}
              </div>
              <div style={{ fontSize: "10px", color: "#d4a574", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {ROL_LABEL[perfil.rol] || perfil.rol}
                {perfil.restaurante_asignado && ` · ${RESTAURANTES_INFO[perfil.restaurante_asignado]?.nombre || perfil.restaurante_asignado}`}
              </div>
            </div>
            <button
              onClick={cerrarSesion}
              title="Cerrar sesión"
              style={{
                background: "transparent",
                border: "1px solid #d4a574",
                color: "#d4a574",
                padding: "8px 10px",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "12px",
              }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* CONTENIDO */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px 16px 60px" }}>

        {/* FECHA DE HOY */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "13px",
          color: "#6b5d47",
          marginBottom: "16px",
          fontWeight: 500,
        }}>
          <Calendar size={15} />
          {new Date().toLocaleDateString("es-MX", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          <button
            onClick={cargarReservas}
            title="Recargar"
            style={{
              marginLeft: "auto",
              background: "white",
              border: "1px solid #d4a574",
              color: "#8b6914",
              padding: "6px 10px",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            <RefreshCw size={13} /> Actualizar
          </button>
        </div>

        {/* STATS */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "10px",
          marginBottom: "20px",
        }}>
          <StatCard label="Total" valor={stats.total} color="#1a3a2e" icon={<Sparkles size={14} />} />
          <StatCard label="Pendientes" valor={stats.pendientes} color="#c9962b" icon={<Clock size={14} />} />
          <StatCard label="Llegados" valor={stats.llegados} color="#2d7d46" icon={<CheckCircle2 size={14} />} />
          <StatCard label="No show" valor={stats.noShow} color="#c73e3a" icon={<XCircle size={14} />} />
          <StatCard label="Comensales" valor={stats.personas} color="#2c3e50" icon={<Users size={14} />} />
        </div>

        {/* FILTROS */}
        <div style={{
          background: "white",
          padding: "14px 16px",
          borderRadius: "12px",
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        }}>
          <Filter size={15} color="#8b7355" />
          <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#8b7355", fontWeight: 600 }}>
            Filtros:
          </span>

          {mostrarFiltroRestaurante && (
            <select
              value={filtroRestaurante}
              onChange={(e) => setFiltroRestaurante(e.target.value)}
              style={selectStyle}
            >
              <option value="todos">Todos los restaurantes</option>
              <option value="el-nido">El Nido</option>
              <option value="soulbox">Soulbox</option>
              <option value="bocamar">Bocamar</option>
              <option value="leonessa">Leonessa</option>
            </select>
          )}

          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            style={selectStyle}
          >
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="confirmada">Confirmadas</option>
            <option value="llegado">Llegados</option>
            <option value="no_show">No show</option>
          </select>
        </div>

        {/* LISTA DE RESERVAS */}
        {cargando ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#8b7355" }}>
            <Loader2 size={28} style={{ animation: "spin 1s linear infinite", marginBottom: "10px" }} />
            <div style={{ fontSize: "13px" }}>Cargando reservas...</div>
          </div>
        ) : error ? (
          <div style={{
            background: "#fdecea",
            border: "1px solid #f5c2c7",
            color: "#842029",
            padding: "16px",
            borderRadius: "10px",
            fontSize: "13px",
          }}>
            Error: {error}
          </div>
        ) : reservasFiltradas.length === 0 ? (
          <div style={{
            background: "white",
            padding: "60px 20px",
            borderRadius: "12px",
            textAlign: "center",
            color: "#8b7355",
            border: "1px dashed #d4a574",
          }}>
            <Sparkles size={32} color="#d4a574" style={{ marginBottom: "12px" }} />
            <div style={{ fontSize: "16px", fontWeight: 500, marginBottom: "4px", color: "#2c2416" }}>
              Sin reservas por ahora
            </div>
            <div style={{ fontSize: "13px" }}>
              {reservas.length > 0 ? "Ajusta los filtros para ver más" : "Las reservas del día aparecerán aquí"}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {reservasFiltradas.map((reserva) => (
              <ReservaCard
                key={reserva.id}
                reserva={reserva}
                onMarcarLlegado={() => cambiarEstado(reserva.id, "llegado")}
                onMarcarNoShow={() => cambiarEstado(reserva.id, "no_show")}
                onMarcarPendiente={() => cambiarEstado(reserva.id, "pendiente")}
                accionando={accionandoId === reserva.id}
                perfil={perfil}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        select { cursor: pointer; }
      `}</style>
    </div>
  );
}

function StatCard({ label, valor, color, icon }) {
  return (
    <div style={{
      background: "white",
      padding: "12px 14px",
      borderRadius: "12px",
      borderLeft: `4px solid ${color}`,
      boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "10px",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color: "#8b7355",
        fontWeight: 600,
        marginBottom: "4px",
      }}>
        {icon}
        {label}
      </div>
      <div style={{
        fontSize: "26px",
        fontWeight: 700,
        color: color,
        lineHeight: 1,
      }}>
        {valor}
      </div>
    </div>
  );
}

function ReservaCard({ reserva, onMarcarLlegado, onMarcarNoShow, onMarcarPendiente, accionando, perfil }) {
  const info = RESTAURANTES_INFO[reserva.restaurante_id] || { nombre: reserva.restaurante_id, color: "#8b7355" };
  const estadoInfo = ESTADO_INFO[reserva.estado] || { label: reserva.estado, color: "#8b7355", bg: "#f0ece4" };

  // Puede tomar acciones: hostess, fb_manager o admin
  const puedeActuar = ["hostess", "fb_manager", "admin"].includes(perfil.rol);
  const estadoFinal = reserva.estado === "llegado" || reserva.estado === "no_show";

  return (
    <div style={{
      background: "white",
      borderRadius: "14px",
      padding: "16px 18px",
      boxShadow: "0 2px 14px rgba(0,0,0,0.05)",
      borderLeft: `5px solid ${info.color}`,
      opacity: estadoFinal ? 0.75 : 1,
    }}>
      {/* Header: restaurante + hora + estado */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "10px",
        flexWrap: "wrap",
        gap: "8px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            background: info.color,
            color: "white",
            fontSize: "10px",
            letterSpacing: "0.1em",
            padding: "4px 10px",
            borderRadius: "100px",
            fontWeight: 700,
            textTransform: "uppercase",
          }}>
            {info.nombre}
          </div>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "14px",
            fontWeight: 600,
            color: "#2c2416",
          }}>
            <Clock size={14} color="#8b7355" />
            {(reserva.hora || "").slice(0, 5)}
          </div>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "13px",
            color: "#6b5d47",
          }}>
            <Users size={13} />
            {reserva.personas}
          </div>
        </div>

        <div style={{
          background: estadoInfo.bg,
          color: estadoInfo.color,
          fontSize: "10px",
          letterSpacing: "0.08em",
          padding: "5px 11px",
          borderRadius: "100px",
          fontWeight: 700,
          textTransform: "uppercase",
          border: `1px solid ${estadoInfo.color}40`,
        }}>
          {estadoInfo.label}
        </div>
      </div>

      {/* Datos del cliente */}
      <div style={{ marginBottom: "10px" }}>
        <div style={{
          fontSize: "17px",
          fontWeight: 600,
          color: "#2c2416",
          marginBottom: "4px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}>
          <User size={15} color="#8b7355" />
          {reserva.cliente_nombre}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "12px", color: "#6b5d47" }}>
          {reserva.cliente_telefono && (
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Phone size={12} /> {reserva.cliente_telefono}
            </span>
          )}
          {reserva.cliente_hotel && (
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Hotel size={12} /> {reserva.cliente_hotel}
            </span>
          )}
          <span style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            background: "#f5ead8",
            padding: "2px 8px",
            borderRadius: "6px",
            fontWeight: 600,
            color: "#8b6914",
          }}>
            🎫 {reserva.codigo_referidor}
          </span>
        </div>
        {reserva.notas && (
          <div style={{
            marginTop: "8px",
            padding: "8px 10px",
            background: "#faf6f0",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#6b5d47",
            display: "flex",
            gap: "6px",
            alignItems: "flex-start",
          }}>
            <MessageSquare size={12} style={{ marginTop: "2px", flexShrink: 0 }} />
            {reserva.notas}
          </div>
        )}
      </div>

      {/* Acciones */}
      {puedeActuar && (
        <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
          {!estadoFinal ? (
            <>
              <button
                onClick={onMarcarLlegado}
                disabled={accionando}
                style={{
                  flex: 1,
                  minWidth: "130px",
                  background: "#2d7d46",
                  color: "white",
                  border: "none",
                  padding: "10px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: accionando ? "not-allowed" : "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  opacity: accionando ? 0.6 : 1,
                }}
              >
                <CheckCircle2 size={14} /> Llegó
              </button>
              <button
                onClick={onMarcarNoShow}
                disabled={accionando}
                style={{
                  flex: 1,
                  minWidth: "130px",
                  background: "#c73e3a",
                  color: "white",
                  border: "none",
                  padding: "10px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: accionando ? "not-allowed" : "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  opacity: accionando ? 0.6 : 1,
                }}
              >
                <XCircle size={14} /> No show
              </button>
            </>
          ) : (
            <button
              onClick={onMarcarPendiente}
              disabled={accionando}
              style={{
                background: "#f0ece4",
                color: "#6b5d47",
                border: "1px solid #d4c5a0",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "11px",
                fontWeight: 600,
                cursor: accionando ? "not-allowed" : "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Deshacer
            </button>
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
  padding: "8px 12px",
  border: "1px solid #d4c5a0",
  borderRadius: "8px",
  fontFamily: "'Inter', sans-serif",
  fontSize: "12px",
  background: "white",
  color: "#2c2416",
  outline: "none",
  fontWeight: 500,
};
