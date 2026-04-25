import { useState } from "react";
import { Sparkles } from "lucide-react";

export default function Reportes({ perfil }) {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center", color: "#d4a574" }}>
      <Sparkles size={48} style={{ marginBottom: "16px", opacity: 0.6 }} />
      <h2 style={{
        fontFamily: "'Italiana', serif",
        fontSize: "28px",
        fontWeight: 400,
        marginBottom: "12px",
        color: "#f5ead8"
      }}>
        Reportes
      </h2>
      <p style={{ fontSize: "14px", opacity: 0.7, marginBottom: "8px" }}>
        Módulo en construcción
      </p>
      <p style={{ fontSize: "12px", opacity: 0.5 }}>
        Hola {perfil?.nombre || "admin"}, próximamente verás aquí el resumen operativo, comercial y financiero.
      </p>
    </div>
  );
}
