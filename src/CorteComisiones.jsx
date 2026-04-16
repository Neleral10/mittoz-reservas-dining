import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ISO week string → "2026-W16"
function getWeekString(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const year = d.getFullYear()
  const week = Math.ceil(((d - new Date(year, 0, 1)) / 86400000 + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

// Rango lunes–domingo de una semana ISO
function getWeekRange(weekStr) {
  const [year, week] = weekStr.split('-W').map(Number)
  const jan4 = new Date(year, 0, 4)
  const dow = jan4.getDay() || 7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - dow + 1 + (week - 1) * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const opts = { day: '2-digit', month: 'short' }
  return {
    from: monday.toISOString().split('T')[0],
    to: sunday.toISOString().split('T')[0],
    label: `${monday.toLocaleDateString('es-MX', opts)} – ${sunday.toLocaleDateString('es-MX', { ...opts, year: 'numeric' })}`
  }
}

// Parsea "Hotel Xaloc · María" → { hotel, recepcionista }
// Si no hay separador · usa el campo completo como nombre del hotel (sin recepcionista asignado)
function parseHotel(clienteHotel) {
  if (!clienteHotel || clienteHotel.trim() === '') {
    return { hotel: '—', recepcionista: 'Sin referidor', tieneRecep: false }
  }
  if (clienteHotel.includes(' · ')) {
    const [hotel, ...rest] = clienteHotel.split(' · ')
    return { hotel: hotel.trim(), recepcionista: rest.join(' · ').trim(), tieneRecep: true }
  }
  return { hotel: clienteHotel.trim(), recepcionista: clienteHotel.trim(), tieneRecep: false }
}

const RESTAURANTES = {
  'el-nido': 'El Nido',
  bocamar: 'Bocamar',
  soulbox: 'Soulbox',
  leonessa: 'Leonessa',
  'la-palapa': 'La Palapa',
}

const fmt = n =>
  `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`

export default function CorteComisiones({ userRole }) {
  const currentWeek = getWeekString(new Date())
  const [selectedWeek, setSelectedWeek] = useState(currentWeek)
  const [reservas, setReservas] = useState([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(null)
  const [expandedGrupo, setExpandedGrupo] = useState(null)

  const weekRange = getWeekRange(selectedWeek)

  useEffect(() => { fetchData() }, [selectedWeek])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('reservas')
      .select(`
        id, fecha, restaurante_id, cliente_nombre, cliente_hotel,
        personas, consumo_subtotal, comision_monto,
        validacion_estado, fecha_pago_comision, semana_corte
      `)
      .eq('estado', 'llegado')
      .not('comision_monto', 'is', null)
      .gte('fecha', weekRange.from)
      .lte('fecha', weekRange.to)
      .order('fecha', { ascending: true })

    if (!error) setReservas(data || [])
    setLoading(false)
  }

  // Agrupar por recepcionista
  const grouped = {}
  reservas.forEach(r => {
    const { hotel, recepcionista, tieneRecep } = parseHotel(r.cliente_hotel)
    if (!grouped[recepcionista]) {
      grouped[recepcionista] = {
        recepcionista,
        hotel,
        tieneRecep,
        reservas: [],
        totalConsumo: 0,
        totalComision: 0,
        allPagado: true,
      }
    }
    grouped[recepcionista].reservas.push(r)
    grouped[recepcionista].totalConsumo += parseFloat(r.consumo_subtotal || 0)
    grouped[recepcionista].totalComision += parseFloat(r.comision_monto || 0)
    if (r.validacion_estado !== 'pagado') grouped[recepcionista].allPagado = false
  })

  const grupos = Object.values(grouped).sort((a, b) =>
    a.allPagado === b.allPagado ? 0 : a.allPagado ? 1 : -1
  )

  const grandTotalConsumo = grupos.reduce((s, g) => s + g.totalConsumo, 0)
  const grandTotalComision = grupos.reduce((s, g) => s + g.totalComision, 0)
  const pendienteCount = grupos.filter(g => !g.allPagado).length

  async function marcarPagado(grupo) {
    setMarking(grupo.recepcionista)
    const ids = grupo.reservas.map(r => r.id)
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase
      .from('reservas')
      .update({ validacion_estado: 'pagado', fecha_pago_comision: today })
      .in('id', ids)
    if (!error) await fetchData()
    setMarking(null)
  }

  function exportCSV() {
    const header = ['Semana', 'Recepcionista', 'Hotel', 'Fecha', 'Restaurante', 'Cliente', 'Personas', 'Consumo', 'Comisión 5%', 'Estado Pago']
    const rows = reservas.map(r => {
      const { hotel, recepcionista } = parseHotel(r.cliente_hotel)
      return [
        selectedWeek, recepcionista, hotel, r.fecha,
        RESTAURANTES[r.restaurante_id] || r.restaurante_id,
        r.cliente_nombre, r.personas,
        r.consumo_subtotal, r.comision_monto,
        r.validacion_estado || 'pendiente'
      ].join(',')
    })
    const totals = `,,,,,,TOTAL,${grandTotalConsumo.toFixed(2)},${grandTotalComision.toFixed(2)},`
    const csv = [header.join(','), ...rows, '', totals].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `comisiones-${selectedWeek}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Opciones de semana: semana actual + 8 semanas atrás
  const weekOptions = Array.from({ length: 9 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i * 7)
    return getWeekString(d)
  })

  return (
    <div style={{ padding: '1rem', maxWidth: 920, margin: '0 auto', fontFamily: 'inherit' }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#3d2b1f', fontWeight: 700 }}>
            Corte de Comisiones
          </h2>
          <p style={{ margin: '0.2rem 0 0', color: '#999', fontSize: '0.82rem' }}>
            {weekRange.label}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select
            value={selectedWeek}
            onChange={e => setSelectedWeek(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem', borderRadius: 8,
              border: '1px solid #e0d5cc', background: '#fff',
              fontSize: '0.85rem', color: '#3d2b1f', cursor: 'pointer'
            }}
          >
            {weekOptions.map(w => {
              const r = getWeekRange(w)
              return (
                <option key={w} value={w}>
                  {w} · {r.label}
                </option>
              )
            })}
          </select>
          <button
            onClick={exportCSV}
            style={{
              padding: '0.45rem 0.9rem', borderRadius: 8,
              border: '1px solid #b08968', background: '#fff',
              color: '#b08968', fontSize: '0.85rem',
              cursor: 'pointer', fontWeight: 600
            }}
          >
            ↓ Exportar CSV
          </button>
        </div>
      </div>

      {/* ── RESUMEN ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.65rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Reservas llegadas', value: reservas.length, color: '#3d2b1f' },
          { label: 'Consumo total', value: fmt(grandTotalConsumo), color: '#2e7d32' },
          { label: 'A pagar (5%)', value: fmt(grandTotalComision), color: '#b08968' },
          {
            label: 'Pendientes de pago',
            value: pendienteCount,
            color: pendienteCount > 0 ? '#c0392b' : '#2e7d32',
            sub: pendienteCount > 0 ? 'recepcionistas' : '✓ Todo pagado'
          },
        ].map(c => (
          <div key={c.label} style={{
            background: '#fff', border: '1px solid #e0d5cc',
            borderRadius: 12, padding: '0.8rem 1rem'
          }}>
            <div style={{ fontSize: '0.7rem', color: '#aaa', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              {c.label}
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: c.color, lineHeight: 1.1 }}>
              {c.value}
            </div>
            {c.sub && (
              <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: 2 }}>{c.sub}</div>
            )}
          </div>
        ))}
      </div>

      {/* ── CONTENIDO ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>
          Cargando semana {selectedWeek}…
        </div>
      ) : grupos.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '3rem', color: '#bbb',
          background: '#fff', borderRadius: 14, border: '1px solid #e0d5cc'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>📋</div>
          <div style={{ fontWeight: 600, color: '#aaa' }}>Sin comisiones para esta semana</div>
          <div style={{ fontSize: '0.82rem', color: '#ccc', marginTop: 4 }}>
            Solo aparecen reservas con estado "llegado" y consumo registrado
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {grupos.map(grupo => {
            const isPagado = grupo.allPagado
            const isExpanded = expandedGrupo === grupo.recepcionista
            return (
              <div
                key={grupo.recepcionista}
                style={{
                  background: '#fff',
                  border: `1.5px solid ${isPagado ? '#c8e6c9' : '#ffe0b2'}`,
                  borderRadius: 14, overflow: 'hidden'
                }}
              >
                {/* Encabezado del grupo */}
                <div
                  onClick={() => setExpandedGrupo(isExpanded ? null : grupo.recepcionista)}
                  style={{
                    padding: '0.85rem 1.1rem',
                    background: isPagado ? '#f1f8f1' : '#fff9f0',
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem',
                    cursor: 'pointer', userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: '#3d2b1f' }}>
                      {grupo.recepcionista}
                    </span>
                    {grupo.tieneRecep && (
                      <span style={{
                        fontSize: '0.75rem', color: '#888',
                        background: '#f0ebe6', borderRadius: 6,
                        padding: '2px 8px'
                      }}>
                        {grupo.hotel}
                      </span>
                    )}
                    <span style={{
                      fontSize: '0.72rem', color: '#aaa',
                      background: '#faf7f4', borderRadius: 6, padding: '2px 8px'
                    }}>
                      {grupo.reservas.length} reserva{grupo.reservas.length !== 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#aaa' }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', color: '#aaa', textTransform: 'uppercase' }}>Comisión</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#b08968' }}>
                        {fmt(grupo.totalComision)}
                      </div>
                    </div>

                    {userRole === 'admin' && (
                      isPagado ? (
                        <span style={{
                          padding: '0.3rem 0.85rem', borderRadius: 20,
                          background: '#e8f5e9', color: '#2e7d32',
                          fontSize: '0.78rem', fontWeight: 600,
                          whiteSpace: 'nowrap'
                        }}>
                          ✓ Pagado
                        </span>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); marcarPagado(grupo) }}
                          disabled={marking === grupo.recepcionista}
                          style={{
                            padding: '0.35rem 0.85rem', borderRadius: 20,
                            background: '#b08968', color: '#fff', border: 'none',
                            cursor: marking === grupo.recepcionista ? 'wait' : 'pointer',
                            fontSize: '0.82rem', fontWeight: 600,
                            opacity: marking === grupo.recepcionista ? 0.7 : 1,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {marking === grupo.recepcionista ? 'Guardando…' : 'Marcar Pagado'}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Tabla de reservas (expandible) */}
                {isExpanded && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                      <thead>
                        <tr style={{ background: '#faf7f4' }}>
                          {['Fecha', 'Restaurante', 'Cliente', 'Personas', 'Consumo', 'Comisión 5%'].map(h => (
                            <th key={h} style={{
                              padding: '0.5rem 0.9rem', textAlign: 'left',
                              color: '#aaa', fontWeight: 500,
                              borderBottom: '1px solid #f0ebe6',
                              whiteSpace: 'nowrap', fontSize: '0.72rem',
                              textTransform: 'uppercase', letterSpacing: '0.03em'
                            }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.reservas.map((r, i) => (
                          <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#fdfaf8' }}>
                            <td style={{ padding: '0.55rem 0.9rem', color: '#666', whiteSpace: 'nowrap' }}>
                              {r.fecha}
                            </td>
                            <td style={{ padding: '0.55rem 0.9rem' }}>
                              <span style={{
                                background: '#f0ebe6', borderRadius: 6,
                                padding: '2px 7px', fontSize: '0.77rem',
                                color: '#3d2b1f', fontWeight: 500
                              }}>
                                {RESTAURANTES[r.restaurante_id] || r.restaurante_id || '—'}
                              </span>
                            </td>
                            <td style={{ padding: '0.55rem 0.9rem', color: '#3d2b1f', fontWeight: 500 }}>
                              {r.cliente_nombre}
                            </td>
                            <td style={{ padding: '0.55rem 0.9rem', color: '#888', textAlign: 'center' }}>
                              {r.personas}
                            </td>
                            <td style={{ padding: '0.55rem 0.9rem', color: '#2e7d32', fontWeight: 500, whiteSpace: 'nowrap' }}>
                              {fmt(r.consumo_subtotal)}
                            </td>
                            <td style={{ padding: '0.55rem 0.9rem', color: '#b08968', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {fmt(r.comision_monto)}
                            </td>
                          </tr>
                        ))}
                        {/* Fila de subtotal */}
                        <tr style={{ background: '#faf7f4', fontWeight: 700 }}>
                          <td colSpan={4} style={{
                            padding: '0.55rem 0.9rem', color: '#aaa',
                            fontSize: '0.75rem', textTransform: 'uppercase'
                          }}>
                            Subtotal · {grupo.reservas.length} reserva{grupo.reservas.length !== 1 ? 's' : ''}
                          </td>
                          <td style={{ padding: '0.55rem 0.9rem', color: '#2e7d32', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {fmt(grupo.totalConsumo)}
                          </td>
                          <td style={{ padding: '0.55rem 0.9rem', color: '#b08968', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {fmt(grupo.totalComision)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}

          {/* Total general */}
          {grupos.length > 1 && (
            <div style={{
              background: '#3d2b1f', borderRadius: 12,
              padding: '0.85rem 1.2rem',
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem'
            }}>
              <span style={{ color: '#e0d5cc', fontWeight: 600, fontSize: '0.9rem' }}>
                TOTAL SEMANA · {grupos.length} recepcionistas
              </span>
              <div style={{ display: 'flex', gap: '2rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#b08968', textTransform: 'uppercase' }}>Consumo</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{fmt(grandTotalConsumo)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#b08968', textTransform: 'uppercase' }}>A pagar</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#b08968' }}>{fmt(grandTotalComision)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Nota de convención */}
      <div style={{
        marginTop: '1.5rem', padding: '0.7rem 1rem',
        background: '#faf7f4', borderRadius: 10,
        border: '1px solid #e0d5cc', fontSize: '0.78rem', color: '#aaa'
      }}>
        💡 <strong style={{ color: '#b08968' }}>Convención para recepcionistas:</strong>{' '}
        en el campo Hotel deben escribir{' '}
        <code style={{ background: '#f0ebe6', padding: '1px 5px', borderRadius: 4, color: '#3d2b1f' }}>
          NombreHotel · NombreRecepcionista
        </code>{' '}
        Ejemplo: <em>Hotel Xaloc · María</em>
      </div>
    </div>
  )
}
