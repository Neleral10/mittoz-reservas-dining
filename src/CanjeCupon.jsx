import { useState, useRef, useEffect } from 'react';
import { supabase } from './lib/supabase';

// === Etiquetas de los restaurantes ===
const LOCALES = { bocamar: 'Bocamar', soulbox: 'Soulbox', elnido: 'El Nido', leonessa: 'Leonessa' };
const ORIGENES = { ...LOCALES, hotelmittoz: 'Hotel Mittoz' };
const BENEFICIOS = {
  bebida: 'Mojito, margarita o limonada por persona',
  combo_leonessa: 'Pan + café americano a $100 por persona',
  descuento_10: '10% de descuento',
};

// Lee ?local= de la URL para fijar el restaurante en cada caja (opcional)
const localURL = (new URLSearchParams(window.location.search).get('local') || '').toLowerCase();

const fmt = (iso) =>
  iso ? new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export default function CanjeCupon() {
  const [usuario, setUsuario] = useState(null);
  const [verificandoAuth, setVerificandoAuth] = useState(true);

  const [local, setLocal] = useState(LOCALES[localURL] ? localURL : '');
  const [codigo, setCodigo] = useState('');
  const [estado, setEstado] = useState('idle'); // idle | buscando | ok | rechazado | guardando | exito
  const [cupon, setCupon] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [comensales, setComensales] = useState(1);
  const [folio, setFolio] = useState('');
  const [alimentos, setAlimentos] = useState(false);
  const [opciones, setOpciones] = useState([]); // varios cupones al buscar por WhatsApp
  const [exito, setExito] = useState(null);

  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);

  // --- Auth: el canje exige sesión (RLS bloquea lectura/escritura a anónimos) ---
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUsuario(data?.user || null);
      setVerificandoAuth(false);
    });
    return () => { detenerEscaner(); };
  }, []);

  function limpiar() {
    setCodigo(''); setEstado('idle'); setCupon(null); setMensaje('');
    setComensales(1); setFolio(''); setAlimentos(false); setOpciones([]); setExito(null);
  }

  // --- Reglas de dónde se puede canjear cada cupón ---
  function validar(data) {
    if (data.estado === 'canjeado') {
      return `Ya fue canjeado el ${fmt(data.canjeado_en)}${data.canjeado_por ? ' por ' + data.canjeado_por : ''}.`;
    }
    if (data.estado === 'expirado' || (data.expira_en && new Date(data.expira_en) < new Date())) {
      return `Cupón vencido (expiró el ${fmt(data.expira_en)}).`;
    }
    if (data.beneficio === 'combo_leonessa' && local !== 'leonessa') {
      return 'Este cupón es del combo de pan y café: se canjea solo en Leonessa.';
    }
    if (data.beneficio !== 'combo_leonessa' && local === 'leonessa') {
      return 'Este cupón es de bebida: se canjea en Bocamar, Soulbox o El Nido, no en Leonessa.';
    }
    if (data.restaurante_origen === local) {
      return `Este cupón se emitió en ${ORIGENES[data.restaurante_origen]}. Debe canjearse en otro restaurante.`;
    }
    return null;
  }

  function elegir(data) {
    const motivo = validar(data);
    if (motivo) { setEstado('rechazado'); setMensaje(motivo); setCupon(null); return; }
    setOpciones([]); setCupon(data);
    setComensales(Math.min(data.personas_max || 1, 10)); setEstado('ok'); setMensaje('');
  }

  // --- Buscar y validar el código ---
  async function buscar(codeArg) {
    const code = (codeArg ?? codigo).trim().toUpperCase();
    if (!code) return;
    if (!local) { setEstado('rechazado'); setMensaje('Primero selecciona en qué restaurante estás canjeando.'); return; }

    setEstado('buscando'); setMensaje(''); setCupon(null); setOpciones([]);

    // ¿Escribieron un WhatsApp en lugar del código? (cliente que perdió su cupón)
    const tel = code.replace(/\D/g, '');
    if (tel.length >= 10 && tel.length === code.replace(/[\s-]/g, '').length) {
      const { data, error } = await supabase
        .from('cupones_cruzados').select('*')
        .like('cliente_whatsapp', `%${tel.slice(-10)}`).eq('estado', 'emitido') // con o sin lada
        .gt('expira_en', new Date().toISOString())
        .order('expira_en', { ascending: false });
      if (error) { setEstado('rechazado'); setMensaje('Error al consultar. Revisa tu conexión e intenta de nuevo.'); return; }
      const validos = (data || []).filter((d) => !validar(d));
      if (validos.length === 0) { setEstado('rechazado'); setMensaje('Ese WhatsApp no tiene cupones vigentes para canjear aquí.'); return; }
      if (validos.length === 1) return elegir(validos[0]);
      setOpciones(validos); setEstado('idle'); return;
    }

    const { data, error } = await supabase
      .from('cupones_cruzados').select('*').eq('codigo', code).maybeSingle();

    if (error) { setEstado('rechazado'); setMensaje('Error al consultar. Revisa tu conexión e intenta de nuevo.'); return; }
    if (!data) { setEstado('rechazado'); setMensaje('Código no encontrado. Verifícalo con el cliente.'); return; }
    elegir(data);
  }

  // --- Confirmar el canje ---
  async function confirmar() {
    if (!cupon) return;
    if (!folio.trim()) { setMensaje('Captura el folio de la cuenta donde se aplica la cortesía.'); return; }
    if (!comensales || comensales < 1) { setMensaje('Indica cuántas personas reciben la cortesía.'); return; }
    if (cupon.personas_max && Number(comensales) > cupon.personas_max) {
      setMensaje(`Este cupón ampara máximo ${cupon.personas_max} personas.`); return;
    }
    if (cupon.beneficio === 'bebida' && !alimentos) {
      setMensaje('La bebida solo aplica si la mesa pide entrada o plato fuerte.'); return;
    }

    setEstado('guardando'); setMensaje('');

    // El filtro .eq('estado','emitido') evita doble canje si dos cajas lo abren a la vez
    const { data, error } = await supabase
      .from('cupones_cruzados')
      .update({
        estado: 'canjeado',
        canjeado_en: new Date().toISOString(),
        canjeado_por: usuario?.email || 'staff',
        restaurante_destino: local,
        comensales: Number(comensales),
        folio_ticket: folio.trim(),
        consumo_alimentos: cupon.beneficio === 'bebida' ? alimentos : null,
      })
      .eq('id', cupon.id)
      .eq('estado', 'emitido')
      .select();

    if (error) { setEstado('ok'); setMensaje('No se pudo guardar. Intenta de nuevo.'); return; }
    if (!data || data.length === 0) {
      setEstado('rechazado'); setMensaje('Este cupón acaba de ser canjeado en otra caja. No apliques la cortesía.'); setCupon(null); return;
    }
    setExito(data[0]); setEstado('exito');
  }

  // --- Escáner de cámara (carga la librería solo si se usa) ---
  function cargarLibreriaEscaner() {
    return new Promise((resolve, reject) => {
      if (window.Html5Qrcode) return resolve();
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('No se pudo cargar el escáner. Usa la captura manual.'));
      document.head.appendChild(s);
    });
  }

  async function iniciarEscaner() {
    try {
      await cargarLibreriaEscaner();
      setScanning(true);
      setTimeout(async () => {
        try {
          const inst = new window.Html5Qrcode('lector-qr');
          scannerRef.current = inst;
          await inst.start({ facingMode: 'environment' }, { fps: 10, qrbox: 220 },
            (texto) => { onEscaneo(texto); }, () => {});
        } catch (e) { setMensaje('No se pudo abrir la cámara. Usa la captura manual.'); setScanning(false); }
      }, 120);
    } catch (e) { setMensaje(e.message); setScanning(false); }
  }

  async function detenerEscaner() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); await scannerRef.current.clear(); } catch (e) {}
      scannerRef.current = null;
    }
    setScanning(false);
  }

  function onEscaneo(texto) {
    detenerEscaner();
    // El QR puede traer el código directo o una URL con ?codigo=
    let code = texto.trim();
    try { const u = new URL(texto); code = u.searchParams.get('codigo') || texto; } catch (e) {}
    code = code.trim().toUpperCase();
    setCodigo(code);
    buscar(code);
  }

  // ---------- Render ----------
  if (verificandoAuth) return <div style={S.wrap}><p style={S.dim}>Cargando…</p></div>;
  if (!usuario) return (
    <div style={S.wrap}>
      <h1 style={S.h1}>Canje de cupón</h1>
      <p style={S.alertRed}>Inicia sesión en Holbox Dining para poder canjear cupones.</p>
    </div>
  );

  return (
    <div style={S.wrap}>
      <h1 style={S.h1}>Canje de cupón cruzado</h1>
      <p style={S.dim}>Cajero: {usuario.email}</p>

      <label style={S.label}>Restaurante donde canjeas</label>
      <select style={S.input} value={local} disabled={!!LOCALES[localURL]}
        onChange={(e) => { setLocal(e.target.value); limpiar(); }}>
        <option value="">Selecciona…</option>
        {Object.entries(LOCALES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>

      {estado !== 'exito' && (
        <>
          <label style={S.label}>Código del cliente o su WhatsApp</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...S.input, flex: 1, textTransform: 'uppercase' }} value={codigo}
              placeholder="EJ: BOCA-AB3K9P o 9841234567"
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') buscar(); }} />
            <button style={S.btnGold} onClick={() => buscar()}>Buscar</button>
          </div>

          {!scanning && <button style={S.btnGhost} onClick={iniciarEscaner}>📷 Escanear con cámara</button>}
          {scanning && (
            <div style={{ marginTop: 10 }}>
              <div id="lector-qr" style={{ width: '100%', borderRadius: 10, overflow: 'hidden' }} />
              <button style={S.btnGhost} onClick={detenerEscaner}>Cancelar escaneo</button>
            </div>
          )}
        </>
      )}

      {estado === 'buscando' && <p style={S.dim}>Buscando…</p>}

      {mensaje && estado !== 'exito' && (
        <p style={estado === 'rechazado' ? S.alertRed : S.alertAmber}>{mensaje}</p>
      )}

      {opciones.length > 0 && (
        <div style={S.panelOk}>
          <div style={S.okTitle}>Cupones vigentes de ese WhatsApp</div>
          {opciones.map((o) => (
            <button key={o.id} style={{ ...S.btnGhost, textAlign: 'left' }} onClick={() => elegir(o)}>
              {o.codigo} · {BENEFICIOS[o.beneficio]} · {o.cliente_nombre || 'sin nombre'}
            </button>
          ))}
        </div>
      )}

      {estado === 'ok' && cupon && (
        <div style={S.panelOk}>
          <div style={S.okTitle}>✓ Cupón válido</div>
          {cupon.requiere_revision && (
            <p style={S.alertAmber}>Cupón marcado para revisión ({cupon.motivo_revision}). Puedes canjearlo; administración lo revisará.</p>
          )}
          <div style={S.row}><span style={S.k}>Código</span><span style={S.v}>{cupon.codigo}</span></div>
          <div style={S.row}><span style={S.k}>Cliente</span><span style={S.v}>{cupon.cliente_nombre || '—'}</span></div>
          <div style={S.row}><span style={S.k}>Emitido en</span><span style={S.v}>{ORIGENES[cupon.restaurante_origen]}</span></div>
          <div style={S.row}><span style={S.k}>Beneficio</span><span style={S.v}>{BENEFICIOS[cupon.beneficio]}</span></div>
          <div style={S.row}><span style={S.k}>Máximo</span><span style={S.v}>{cupon.personas_max ? `${cupon.personas_max} personas` : '—'}</span></div>
          <div style={S.row}><span style={S.k}>Vence</span><span style={S.v}>{fmt(cupon.expira_en)}</span></div>

          <label style={S.label} htmlFor="comensales">
            {cupon.beneficio === 'combo_leonessa' ? 'Combos a $100' : 'Personas que reciben bebida'}
          </label>
          <select id="comensales" style={S.input} value={comensales} onChange={(e) => setComensales(e.target.value)}>
            {Array.from({ length: cupon.personas_max || 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>

          {cupon.beneficio === 'bebida' && (
            <>
              <label style={{ ...S.label, display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
                <input type="checkbox" checked={alimentos} onChange={(e) => setAlimentos(e.target.checked)} />
                La mesa pidió entrada o plato fuerte
              </label>
              <p style={S.dim}>Mojito y margarita solo a mayores de 18. Menores: limonada.</p>
            </>
          )}

          <label style={S.label} htmlFor="folio">Folio de la cuenta donde se aplica</label>
          <input id="folio" style={S.input} value={folio} placeholder="Folio de la cuenta"
            onChange={(e) => setFolio(e.target.value)} />

          <button style={{ ...S.btnGold, width: '100%', marginTop: 14, padding: 14 }} onClick={confirmar}>
            Confirmar canje
          </button>
        </div>
      )}

      {estado === 'guardando' && <p style={S.dim}>Guardando…</p>}

      {estado === 'exito' && exito && (
        <div style={S.panelOk}>
          <div style={S.okTitle}>✓ Canjeado</div>
          <div style={S.row}><span style={S.k}>Código</span><span style={S.v}>{exito.codigo}</span></div>
          <div style={S.row}><span style={S.k}>De → a</span><span style={S.v}>{ORIGENES[exito.restaurante_origen]} → {LOCALES[exito.restaurante_destino]}</span></div>
          <div style={S.row}><span style={S.k}>{exito.beneficio === 'combo_leonessa' ? 'Combos' : 'Bebidas'}</span><span style={S.v}>{exito.comensales}</span></div>
          <div style={S.row}><span style={S.k}>Folio</span><span style={S.v}>{exito.folio_ticket}</span></div>
          <div style={S.row}><span style={S.k}>Hora</span><span style={S.v}>{fmt(exito.canjeado_en)}</span></div>
          <button style={{ ...S.btnGhost, width: '100%', marginTop: 14 }} onClick={limpiar}>Canjear otro</button>
        </div>
      )}
    </div>
  );
}

const NAVY = '#16203d', GOLD = '#c8a24a';
const S = {
  wrap: { maxWidth: 440, margin: '0 auto', padding: 20, fontFamily: 'system-ui, sans-serif', color: NAVY },
  h1: { fontSize: 22, marginBottom: 4 },
  dim: { fontSize: 13, color: '#777', margin: '6px 0' },
  label: { display: 'block', fontSize: 13, fontWeight: 600, margin: '14px 0 4px' },
  input: { width: '100%', padding: 12, fontSize: 16, border: '1px solid #ccc', borderRadius: 8, boxSizing: 'border-box' },
  btnGold: { background: GOLD, color: NAVY, border: 'none', borderRadius: 8, padding: '12px 16px', fontWeight: 700, fontSize: 15, cursor: 'pointer' },
  btnGhost: { background: '#fff', color: NAVY, border: `1px solid ${NAVY}`, borderRadius: 8, padding: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginTop: 10, width: '100%' },
  panelOk: { border: `1px solid ${GOLD}`, borderRadius: 12, padding: 16, marginTop: 16, background: '#fbf7ec' },
  okTitle: { color: '#1a7a3a', fontWeight: 700, fontSize: 16, marginBottom: 10 },
  row: { display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 14, borderBottom: '1px solid #eee' },
  k: { color: '#777' }, v: { fontWeight: 600 },
  alertRed: { background: '#fdecec', color: '#b00', padding: 12, borderRadius: 8, fontSize: 14, marginTop: 12 },
  alertAmber: { background: '#fef6e7', color: '#8a6d1a', padding: 12, borderRadius: 8, fontSize: 14, marginTop: 12 },
};
