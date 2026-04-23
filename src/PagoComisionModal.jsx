import { useState } from 'react'
import { supabase } from './lib/supabase'

/**
 * Modal para registrar pago de comisiones semanales
 * + genera comprobante imprimible con folio
 *
 * Props:
 *   open              boolean
 *   onClose           function() — cierra el modal
 *   onPagoRegistrado  function(pago) — callback tras guardar (para refrescar lista)
 *   grupo             object con { recepcionista, hotel, totalConsumo, totalComision, reservas: [...] }
 *   semanaCorte       string "2026-W16"
 *   semanaInicio      string "YYYY-MM-DD"
 *   semanaFin         string "YYYY-MM-DD"
 */
export default function PagoComisionModal({
  open,
  onClose,
  onPagoRegistrado,
  grupo,
  semanaCorte,
  semanaInicio,
  semanaFin
}) {
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [referenciaPago, setReferenciaPago] = useState('')
  const [aprobadoPor, setAprobadoPor] = useState('nelson')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pagoRegistrado, setPagoRegistrado] = useState(null)

  if (!open || !grupo) return null

  const handleRegistrar = async () => {
    setError('')
    if (!aprobadoPor) {
      setError('Indica quién aprueba el pago')
      return
    }
    if (!grupo.reservas || grupo.reservas.length === 0) {
      setError('No hay reservas para pagar')
      return
    }

    setLoading(true)

    try {
      // 1) Generar folio
      const { data: folio, error: folioErr } = await supabase
        .rpc('generar_folio_comision')

      if (folioErr) throw folioErr

      // 2) Insertar pago
      const { data: pago, error: pagoErr } = await supabase
        .from('pagos_comisiones')
        .insert({
          folio,
          semana_corte: semanaCorte,
          semana_inicio: semanaInicio,
          semana_fin: semanaFin,
          beneficiario: grupo.recepcionista,
          hotel: grupo.hotel || null,
          cantidad_reservas: grupo.reservas.length,
          monto_reservas: grupo.totalConsumo,
          porcentaje: 5,
          monto_comision: grupo.totalComision,
          metodo_pago: metodoPago,
          referencia_pago: referenciaPago.trim() || null,
          aprobado_por: aprobadoPor,
          notas: notas.trim() || null
        })
        .select()
        .single()

      if (pagoErr) throw pagoErr

      // 3) Vincular reservas al pago + marcar como pagadas
      const reservaIds = grupo.reservas.map(r => r.id)
      const today = new Date().toISOString().split('T')[0]

      const { error: linkErr } = await supabase
        .from('reservas')
        .update({
          validacion_estado: 'pagado',
          fecha_pago_comision: today,
          comision_pagada: true,
          pago_comision_id: pago.id
        })
        .in('id', reservaIds)

      if (linkErr) throw linkErr

      setPagoRegistrado(pago)
    } catch (e) {
      setError(e.message || 'Error al registrar el pago')
    } finally {
      setLoading(false)
    }
  }

  const handleImprimir = () => {
    window.print()
  }

  const handleCerrar = () => {
    const pago = pagoRegistrado
    setMetodoPago('efectivo')
    setReferenciaPago('')
    setAprobadoPor('nelson')
    setNotas('')
    setError('')
    setPagoRegistrado(null)
    onClose()
    if (pago && onPagoRegistrado) onPagoRegistrado(pago)
  }

  // ===== ESTILOS =====
  const overlay = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 20, overflowY: 'auto'
  }
  const modal = {
    background: '#fff',
    border: '1px solid #e0d5cc',
    borderRadius: 12,
    padding: 24,
    maxWidth: 560, width: '100%',
    color: '#3d2b1f',
    maxHeight: '90vh', overflowY: 'auto',
    fontFamily: 'inherit'
  }
  const title = { fontSize: '1.25rem', fontWeight: 700, color: '#3d2b1f', marginBottom: 4 }
  const subtitle = { fontSize: '0.82rem', color: '#999', marginBottom: 16 }
  const label = { display: 'block', fontSize: '0.72rem', color: '#888', marginBottom: 4, marginTop: 12, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }
  const input = {
    width: '100%', padding: '0.55rem 0.7rem',
    background: '#fff', border: '1px solid #e0d5cc',
    borderRadius: 8, color: '#3d2b1f', fontSize: '0.9rem', boxSizing: 'border-box'
  }
  const btnPrimary = {
    padding: '0.55rem 1rem', background: '#b08968', color: '#fff',
    border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem'
  }
  const btnSecondary = {
    padding: '0.55rem 1rem', background: 'transparent', color: '#888',
    border: '1px solid #e0d5cc', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem'
  }
  const errorBox = {
    background: '#fff0ed', color: '#c0392b',
    padding: '0.5rem 0.75rem', borderRadius: 6, fontSize: '0.8rem', marginTop: 10,
    border: '1px solid #f5c6cb'
  }
  const summary = {
    background: '#fffaf3',
    border: '1px solid #e0d5cc',
    borderRadius: 8, padding: 12, marginBottom: 12
  }

  // ===== VISTA COMPROBANTE =====
  if (pagoRegistrado) {
    return (
      <>
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .comprobante-print, .comprobante-print * { visibility: visible; }
            .comprobante-print {
              position: absolute; left: 0; top: 0; width: 100%;
              background: white !important; color: black !important;
              padding: 40px;
            }
            .no-print { display: none !important; }
          }
        `}</style>
        <div style={overlay} className="no-print">
          <div style={modal}>
            <div style={{ ...title, color: '#2e7d32' }}>✓ Pago registrado</div>
            <div style={subtitle}>Folio: <strong>{pagoRegistrado.folio}</strong></div>

            <div className="comprobante-print" style={{
              background: '#fff', color: '#000', padding: 24, borderRadius: 8, marginTop: 12,
              fontFamily: 'Georgia, serif', border: '1px solid #e0d5cc'
            }}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>GRUPO MITTOZ</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Holbox Dining · Comprobante de Pago de Comisión</div>
              </div>

              <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div><strong>Folio:</strong> {pagoRegistrado.folio}</div>
                  <div><strong>Fecha:</strong> {new Date(pagoRegistrado.fecha_pago).toLocaleDateString('es-MX')}</div>
                </div>

                <div style={{ marginTop: 14, marginBottom: 8 }}>
                  Recibí de <strong>Grupo Mittoz / Holbox Dining</strong> la cantidad de:
                </div>

                <div style={{
                  fontSize: 20, fontWeight: 700, textAlign: 'center',
                  padding: 10, border: '2px solid #000', margin: '10px 0'
                }}>
                  ${Number(pagoRegistrado.monto_comision).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                </div>

                <div style={{ marginTop: 14 }}>
                  Por concepto de comisión del <strong>{pagoRegistrado.porcentaje}%</strong> sobre ventas
                  de reservas con estado "llegado" del período
                  del <strong>{new Date(pagoRegistrado.semana_inicio).toLocaleDateString('es-MX')}</strong> al
                  <strong> {new Date(pagoRegistrado.semana_fin).toLocaleDateString('es-MX')}</strong>
                  {pagoRegistrado.hotel ? <> · Hotel: <strong>{pagoRegistrado.hotel}</strong></> : null}.
                </div>

                <div style={{ marginTop: 14, padding: 10, background: '#f5f5f5' }}>
                  <div><strong>Reservas incluidas:</strong> {pagoRegistrado.cantidad_reservas}</div>
                  <div><strong>Consumo total:</strong> ${Number(pagoRegistrado.monto_reservas).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</div>
                  <div><strong>Método de pago:</strong> {pagoRegistrado.metodo_pago}</div>
                  {pagoRegistrado.referencia_pago && (
                    <div><strong>Referencia:</strong> {pagoRegistrado.referencia_pago}</div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 50, gap: 40 }}>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ borderTop: '1px solid #000', paddingTop: 6, fontSize: 11 }}>
                      <div style={{ fontWeight: 700 }}>{pagoRegistrado.beneficiario}</div>
                      <div>Recibe</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ borderTop: '1px solid #000', paddingTop: 6, fontSize: 11 }}>
                      <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{pagoRegistrado.aprobado_por}</div>
                      <div>Autoriza / Grupo Mittoz</div>
                    </div>
                  </div>
                </div>

                {pagoRegistrado.notas && (
                  <div style={{ marginTop: 16, fontSize: 11, fontStyle: 'italic', borderTop: '1px solid #ccc', paddingTop: 8 }}>
                    <strong>Notas:</strong> {pagoRegistrado.notas}
                  </div>
                )}
              </div>
            </div>

            <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={btnSecondary} onClick={handleCerrar}>Cerrar</button>
              <button style={btnPrimary} onClick={handleImprimir}>Imprimir / Guardar PDF</button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ===== VISTA FORMULARIO =====
  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={title}>Registrar pago de comisión</div>
        <div style={subtitle}>
          {grupo.recepcionista} {grupo.hotel ? `· ${grupo.hotel}` : ''} · Semana {semanaCorte}
        </div>

        <div style={summary}>
          <div style={{ fontSize: '0.72rem', color: '#888' }}>Reservas incluidas</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#3d2b1f' }}>{grupo.reservas.length}</div>
          <div style={{ fontSize: '0.72rem', color: '#888', marginTop: 6 }}>Consumo total</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#3d2b1f' }}>
            ${Number(grupo.totalConsumo).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
          </div>
          <div style={{ fontSize: '0.72rem', color: '#b08968', marginTop: 6 }}>
            Comisión 5%
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#b08968' }}>
            ${Number(grupo.totalComision).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
          </div>
        </div>

        <label style={label}>Método de pago *</label>
        <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} style={input}>
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia bancaria</option>
          <option value="otro">Otro</option>
        </select>

        {metodoPago === 'transferencia' && (
          <>
            <label style={label}>Referencia / Folio bancario</label>
            <input
              type="text"
              value={referenciaPago}
              onChange={e => setReferenciaPago(e.target.value)}
              style={input}
              placeholder="Ej: SPEI 123456789"
            />
          </>
        )}

        <label style={label}>Aprobado por *</label>
        <select value={aprobadoPor} onChange={e => setAprobadoPor(e.target.value)} style={input}>
          <option value="nelson">Nelson</option>
          <option value="erika">Erika</option>
          <option value="ricardo">Ricardo</option>
          <option value="marlen">Marlen</option>
        </select>

        <label style={label}>Notas (opcional)</label>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          style={{ ...input, minHeight: 60, fontFamily: 'inherit' }}
          placeholder="Ej: incluye bono, se pagó retrasado por...."
        />

        {error && <div style={errorBox}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button style={btnSecondary} onClick={handleCerrar} disabled={loading}>
            Cancelar
          </button>
          <button style={btnPrimary} onClick={handleRegistrar} disabled={loading}>
            {loading ? 'Registrando...' : 'Confirmar pago'}
          </button>
        </div>
      </div>
    </div>
  )
}
