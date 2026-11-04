import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { IDIOMAS, TEXTOS, idiomaInicial, guardarIdioma } from './cuponTextos.jsx';

// =====================================================================
// Cortesías cruzadas Mittoz · página que abre el QR del portacuentas
// URL: /cupon?origen=bocamar | soulbox | elnido | leonessa | hotelmittoz
// =====================================================================

// === Único lugar a editar: negocios, destinos, reglas y links de reseña ===
const NEGOCIOS = {
  bocamar:     { nombre: 'Bocamar',      prefijo: 'BOCA', ticket: 'soft',     maxPersonas: 10, mesaConPunto: true,
                 google: 'https://PEGAR_LINK_GOOGLE_BOCAMAR' },
  soulbox:     { nombre: 'Soulbox',      prefijo: 'SOUL', ticket: 'soft',     maxPersonas: 10, mesaConPunto: false,
                 google: 'https://PEGAR_LINK_GOOGLE_SOULBOX' },
  elnido:      { nombre: 'El Nido',      prefijo: 'NIDO', ticket: 'soft',     maxPersonas: 10,
                 google: 'https://PEGAR_LINK_GOOGLE_ELNIDO' },
  leonessa:    { nombre: 'Leonessa',     prefijo: 'LNS',  ticket: 'leonessa', maxPersonas: 6, personasLibres: true,
                 google: 'https://PEGAR_LINK_GOOGLE_LEONESSA' },
  hotelmittoz: { nombre: 'Hotel Mittoz', prefijo: 'MTZ',  ticket: 'ninguno',  maxPersonas: 6, personasLibres: true,
                 google: 'https://PEGAR_LINK_GOOGLE_HOTELMITTOZ' },
};
const DESTINOS_BEBIDA = ['bocamar', 'soulbox', 'elnido'];
const HABITACIONES_MITTOZ = ['101','102','103','104','105','106','107','108','201','202','203','204','205','206','207'];
const VIGENCIA_DIAS = 3;
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I/L
const CLAVE_GUARDADO = 'mittoz_cupon_resultado';

const generarCodigo = (prefijo) => {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  return `${prefijo}-${s}`;
};
const hoyISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Cancun' });
const fmtFecha = (iso, locale = 'es-MX') => new Date(iso).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Cancun' });
const nombresDestinos = (origen) => DESTINOS_BEBIDA.filter((k) => k !== origen).map((k) => NEGOCIOS[k].nombre);
const unirConO = (arr, o = 'o') => arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} ${o} ${arr[arr.length - 1]}`;
// WhatsApp: 10 dígitos = México (se antepone 52); con lada internacional se guarda completo
const normalizarTel = (v) => { const d = v.replace(/\D/g, ''); return d.length === 10 ? `52${d}` : d; };
const leerGuardado = () => { try { return JSON.parse(localStorage.getItem(CLAVE_GUARDADO) || 'null'); } catch { return null; } };
const guardar = (v) => { try { localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

// Reduce la foto a ~1400 px en JPEG para subirla rápido con señal de isla
function reducirImagen(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, 1400 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.82));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('No se pudo abrir la foto'));
    img.src = URL.createObjectURL(file);
  });
}
const dataUrlABlob = async (d) => (await fetch(d)).blob();

function cargarQR() {
  return new Promise((resolve) => {
    if (window.QRCode) return resolve();
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = resolve; s.onerror = resolve;
    document.head.appendChild(s);
  });
}

export default function CuponCruzado() {
  const params = new URLSearchParams(window.location.search);
  let origen = (params.get('origen') || '').toLowerCase().replace(/[^a-z]/g, '');
  if (origen === 'hotel' || origen === 'mittoz') origen = 'hotelmittoz';
  if (origen === 'nido') origen = 'elnido';
  const conf = NEGOCIOS[origen];

  const [idioma, setIdioma] = useState(idiomaInicial);
  const t = TEXTOS[idioma];
  const locale = IDIOMAS.find((i) => i.id === idioma).locale;
  const cambiarIdioma = (id) => { setIdioma(id); guardarIdioma(id); };
  const selector = <SelectorIdioma actual={idioma} onCambio={cambiarIdioma} />;

  const [paso, setPaso] = useState('form'); // form | enviando | listo
  const [foto, setFoto] = useState(null);   // dataURL
  const [lectura, setLectura] = useState(null);
  const [leyendo, setLeyendo] = useState(false);
  const [manual, setManual] = useState(false);
  const [folio, setFolio] = useState('');
  const [personas, setPersonas] = useState('');
  const [habitacion, setHabitacion] = useState('');
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [aceptaAviso, setAceptaAviso] = useState(false);
  const [aceptaPromos, setAceptaPromos] = useState(false);
  const [verAviso, setVerAviso] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    const g = leerGuardado();
    if (g && g.origen === origen && new Date(g.expira) > new Date()) { setResultado(g); setPaso('listo'); }
  }, []);

  if (!conf) return <Marco>{selector}<p style={S.err}>{t.enlaceInvalido}</p></Marco>;

  const conTicket = conf.ticket !== 'ninguno';
  const personasDesdeTicket = conf.ticket === 'soft' && !manual && lectura?.personas;
  // Soft Restaurant: las personas salen del ticket; solo se preguntan si no se pudo leer
  const mostrarPersonas = !conTicket || conf.personasLibres || manual || (lectura && !lectura.personas);

  // --- Foto del ticket y lectura automática ---
  async function onFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setLectura(null); setManual(false); setFolio(''); setPersonas('');
    try {
      const d = await reducirImagen(file);
      setFoto(d); setLeyendo(true);
      const r = await fetch('/api/leer-ticket', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imagen: d }),
      });
      if (!r.ok) throw new Error('sin lectura');
      const l = await r.json();
      if (!l.legible || !l.folio) throw new Error('ilegible');
      setLectura(l); setFolio(String(l.folio).trim());
      if (conf.ticket === 'soft' && l.personas) setPersonas(String(Math.min(Number(l.personas), conf.maxPersonas)));
    } catch {
      setManual(true); // el cliente captura folio y personas; el cupón queda para revisión
    } finally { setLeyendo(false); }
  }

  // --- Validaciones y señales para revisión ---
  function revisar() {
    const motivos = [];
    if (conTicket) {
      if (manual) motivos.push('captura manual');
      if (lectura?.fecha) {
        const dias = (new Date(hoyISO()) - new Date(lectura.fecha)) / 86400000;
        if (dias > 1) return { bloqueo: t.errViejo };
        if (dias < 0) motivos.push('fecha del ticket en el futuro');
      }
      if (conf.ticket === 'soft' && lectura && lectura.sistema !== 'soft_restaurant') motivos.push('el ticket no parece de Soft Restaurant');
      if (conf.ticket === 'leonessa' && lectura && lectura.sistema === 'soft_restaurant') motivos.push('ticket de Soft Restaurant en QR de Leonessa');
      if (typeof conf.mesaConPunto === 'boolean' && lectura?.mesa) {
        if (conf.mesaConPunto !== lectura.mesa.includes('.')) motivos.push(`la mesa ${lectura.mesa} no corresponde a ${conf.nombre}`);
      }
      if (lectura && lectura.tiene_alimentos === false && conf.ticket === 'soft') motivos.push('ticket sin alimentos');
    }
    return { motivos };
  }

  async function enviar(e) {
    e.preventDefault();
    setError('');
    const tel = normalizarTel(whatsapp);
    if (conTicket && !foto) return setError(t.errFoto);
    if (conTicket && !folio.trim()) return setError(t.errFolio);
    if (!conTicket && !habitacion) return setError(t.errHab);
    if (!personas) return setError(t.errPersonas);
    if (nombre.trim().length < 2) return setError(t.errNombre);
    if (tel.length < 11 || tel.length > 15) return setError(t.errTel);
    if (!aceptaAviso) return setError(t.errAviso);

    const rev = revisar();
    if (rev.bloqueo) return setError(rev.bloqueo);

    setPaso('enviando');
    const folioFinal = conTicket ? folio.trim().toUpperCase() : `HAB-${habitacion}-${hoyISO().replace(/-/g, '')}`;
    // Vence al final del día (hora de Holbox) del tercer día
    const ultimoDia = new Date(Date.now() + VIGENCIA_DIAS * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Cancun' });
    const expira = new Date(`${ultimoDia}T23:59:59-05:00`).toISOString();
    const grupo = crypto.randomUUID();

    let rutaFoto = null;
    if (foto) {
      rutaFoto = `${origen}/${hoyISO()}/${grupo}.jpg`;
      const { error: errFoto } = await supabase.storage.from('tickets-cupones')
        .upload(rutaFoto, await dataUrlABlob(foto), { contentType: 'image/jpeg' });
      if (errFoto) rutaFoto = null; // no detiene el cupón; queda para revisión
    }

    const base = {
      restaurante_origen: origen, estado: 'emitido', expira_en: expira, grupo,
      cliente_nombre: nombre.trim(), cliente_whatsapp: tel, acepta_promos: aceptaPromos,
      folio_origen: folioFinal, personas_max: Number(personas),
      foto_ticket: rutaFoto, lectura_ticket: lectura,
      requiere_revision: (rev.motivos.length > 0) || (conTicket && !rutaFoto),
      motivo_revision: [...rev.motivos, ...(conTicket && !rutaFoto ? ['foto no guardada'] : [])].join('; ') || null,
    };
    const tipos = origen === 'leonessa' ? ['bebida'] : ['bebida', 'combo_leonessa'];

    for (let intento = 0; intento < 3; intento++) {
      const filas = tipos.map((t) => ({
        ...base, beneficio: t, codigo: generarCodigo(t === 'combo_leonessa' ? 'CAFE' : conf.prefijo),
      }));
      const { error: err } = await supabase.from('cupones_cruzados').insert(filas);
      if (!err) {
        const res = {
          origen, expira, personas: Number(personas), nombre: nombre.trim(),
          cupones: filas.map((f) => ({ codigo: f.codigo, beneficio: f.beneficio })),
        };
        guardar(res); setResultado(res); setPaso('listo');
        return;
      }
      if (err.code === '23505' && /folio/.test(err.message || '')) {
        setPaso('form');
        return setError(conTicket ? t.errUsado : t.errHabUsada);
      }
      if (err.code !== '23505') break; // otro error
    }
    setPaso('form');
    setError(t.errRed);
  }

  if (paso === 'listo' && resultado) {
    return <Cupones r={resultado} conf={conf} t={t} locale={locale} selector={selector} onOtro={() => { guardar(null); setResultado(null); setPaso('form'); }} />;
  }

  const opcionesPersonas = Array.from({ length: conf.maxPersonas }, (_, i) => i + 1);

  return (
    <Marco>
      {selector}
      <div style={S.eyebrow}>{origen === 'hotelmittoz' ? t.saludoHotel : origen === 'leonessa' ? t.saludoLeonessa : t.saludoRest}</div>
      <h1 style={S.h1}>{conf.nombre}</h1>
      <p style={S.lead}>
        {t.leadBebida(unirConO(nombresDestinos(origen), t.o))}
        {origen !== 'leonessa' && t.leadCombo}.
      </p>

      <form onSubmit={enviar} style={S.form}>
        {conTicket && (
          <div style={S.bloque}>
            <label style={S.label} htmlFor="foto">1. {t.pasoFoto}</label>
            <input id="foto" type="file" accept="image/*" capture="environment" onChange={onFoto} style={S.file} />
            {foto && <img src={foto} alt={t.tuTicket} style={S.preview} />}
            {leyendo && <p style={S.dim}>{t.leyendo}</p>}
            {lectura && !manual && (
              <p style={S.ok}>{t.leido(folio, personasDesdeTicket ? t.persona(Number(personas)) : null)}</p>
            )}
            {manual && (
              <>
                <p style={S.warn}>{t.noLeido}</p>
                <label style={S.label} htmlFor="folio">{conf.ticket === 'leonessa' ? t.recibo : t.folio}</label>
                <input id="folio" style={S.input} value={folio} onChange={(e) => setFolio(e.target.value)}
                  placeholder={`${t.ej} ${conf.ticket === 'leonessa' ? '1-3925' : 'B24311'}`} />
              </>
            )}
          </div>
        )}

        {!conTicket && (
          <div style={S.bloque}>
            <label style={S.label} htmlFor="hab">1. {t.pasoHab}</label>
            <select id="hab" style={S.input} value={habitacion} onChange={(e) => setHabitacion(e.target.value)}>
              <option value="">{t.elige}</option>
              {HABITACIONES_MITTOZ.map((h) => <option key={h} value={h}>{h === '207' ? '207 · Casa Mittoz' : h}</option>)}
            </select>
          </div>
        )}

        {mostrarPersonas && (
          <div style={S.bloque}>
            <label style={S.label} htmlFor="personas">2. {t.cuantas}</label>
            <select id="personas" style={S.input} value={personas} onChange={(e) => setPersonas(e.target.value)}>
              <option value="">{t.elige}</option>
              {opcionesPersonas.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}

        <div style={S.bloque}>
          <label style={S.label} htmlFor="nombre">{mostrarPersonas ? '3' : '2'}. {t.datos}</label>
          <input id="nombre" style={S.input} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t.nombre} autoComplete="name" />
          <input style={{ ...S.input, marginTop: 8 }} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
            placeholder={t.whatsapp} inputMode="tel" autoComplete="tel" aria-label="WhatsApp" />
        </div>

        <label style={S.check}>
          <input type="checkbox" checked={aceptaAviso} onChange={(e) => setAceptaAviso(e.target.checked)} />
          <span>{t.acepto} <button type="button" style={S.link} onClick={() => setVerAviso(!verAviso)}>{t.aviso}</button></span>
        </label>
        {verAviso && <AvisoPrivacidad t={t} />}
        <label style={S.check}>
          <input type="checkbox" checked={aceptaPromos} onChange={(e) => setAceptaPromos(e.target.checked)} />
          <span>{t.promos}</span>
        </label>

        {error && <p style={S.err}>{error}</p>}
        <button type="submit" style={S.btn} disabled={paso === 'enviando' || leyendo}>
          {paso === 'enviando' ? t.generando : t.obtener}
        </button>
        <p style={S.letra}>{t.letraForm(VIGENCIA_DIAS)}</p>
      </form>
    </Marco>
  );
}

// ---------- Pantalla con los cupones ----------
function Cupones({ r, conf, t, locale, selector, onOtro }) {
  const qrs = useRef({});
  useEffect(() => {
    cargarQR().then(() => {
      if (!window.QRCode) return;
      r.cupones.forEach((c) => {
        const el = qrs.current[c.codigo];
        if (!el) return;
        el.innerHTML = '';
        new window.QRCode(el, { text: c.codigo, width: 140, height: 140, colorDark: PETROLEO, colorLight: '#ffffff',
          correctLevel: window.QRCode.CorrectLevel.M });
      });
    });
  }, [r]);

  const destinos = unirConO(nombresDestinos(r.origen), t.o);
  const texto = (c) => c.beneficio === 'combo_leonessa'
    ? { titulo: t.tituloCombo, donde: t.dondeCombo }
    : { titulo: t.tituloBebida, donde: t.dondeBebida(destinos) };
  const vence = fmtFecha(r.expira, locale);

  async function guardarImagen() {
    const W = 720, H = 300 + r.cupones.length * 260;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = PETROLEO; g.fillRect(0, 0, W, H);
    g.fillStyle = CORAL; g.fillRect(0, 0, W, 150);
    g.fillStyle = PETROLEO; g.font = 'bold 40px sans-serif'; g.fillText(t.imgTitulo, 40, 70);
    g.font = '22px sans-serif'; g.fillText(`${r.nombre} · ${t.persona(r.personas)}`, 40, 115);
    let y = 190;
    r.cupones.forEach((cp) => {
      const t = texto(cp);
      g.fillStyle = ARENA; g.fillRect(40, y, W - 80, 230);
      const img = qrs.current[cp.codigo]?.querySelector('canvas');
      if (img) g.drawImage(img, 60, y + 25, 180, 180);
      g.fillStyle = PETROLEO; g.font = 'bold 40px monospace'; g.fillText(cp.codigo, 270, y + 70);
      g.font = 'bold 22px sans-serif'; g.fillText(t.titulo, 270, y + 115);
      g.font = '20px sans-serif'; g.fillText(t.donde, 270, y + 148);
      y += 260;
    });
    g.fillStyle = ARENA; g.font = '20px sans-serif';
    g.fillText(t.imgVence(vence), 40, H - 70);
    g.fillText(t.imgPie, 40, H - 40);
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png'); a.download = `cortesia-mittoz-${r.cupones[0].codigo}.png`; a.click();
  }

  return (
    <Marco>
      {selector}
      <div style={S.eyebrow}>{t.listo(r.nombre)}</div>
      <h1 style={S.h1}>{t.tuCortesia}</h1>
      <p style={S.lead}>{t.muestra(t.persona(r.personas), vence)}</p>
      {r.cupones.map((c) => {
        const t = texto(c);
        return (
          <div key={c.codigo} style={S.cupon}>
            <div ref={(el) => { qrs.current[c.codigo] = el; }} style={S.qr} />
            <div style={{ minWidth: 0 }}>
              <div style={S.codigo}>{c.codigo}</div>
              <div style={S.cuponTitulo}>{t.titulo}</div>
              <div style={S.dim}>{t.donde}</div>
            </div>
          </div>
        );
      })}
      <button style={S.btn} onClick={guardarImagen}>{t.guardar}</button>
      <p style={S.letra}>{t.letraCupon}</p>
      {!conf.google.includes('PEGAR_') && (
        <>
          <hr style={S.hr} />
          <p style={S.dimC}>{t.opinion(conf.nombre)}</p>
          <a href={conf.google} target="_blank" rel="noopener noreferrer" style={S.btnAlt}>{t.opinar}</a>
        </>
      )}
      <button style={S.btnTexto} onClick={onOtro}>{t.otra}</button>
    </Marco>
  );
}

function AvisoPrivacidad({ t }) {
  return (
    <div style={S.aviso}>
      {t.avisoTexto.map((p, i) => <p key={i}>{p}</p>)}
    </div>
  );
}

function SelectorIdioma({ actual, onCambio }) {
  return (
    <div style={S.idiomas} role="group" aria-label="Idioma / Language">
      {IDIOMAS.map((i) => (
        <button key={i.id} type="button" lang={i.id} aria-pressed={actual === i.id} title={i.nombre}
          onClick={() => onCambio(i.id)} style={actual === i.id ? S.idiomaOn : S.idioma}>
          {i.etiqueta}
        </button>
      ))}
    </div>
  );
}

function Marco({ children }) {
  return (
    <div style={S.fondo}>
      <div style={S.wrap}>{children}</div>
    </div>
  );
}

const PETROLEO = '#0B4F5C', TURQUESA = '#00889C', CORAL = '#F2795B', ARENA = '#F4EBDD', MADERA = '#A8744F';
const S = {
  fondo: { minHeight: '100vh', background: ARENA, color: PETROLEO, fontFamily: "'Work Sans', system-ui, sans-serif" },
  wrap: { maxWidth: 480, margin: '0 auto', padding: '28px 20px 40px' },
  eyebrow: { fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600, color: MADERA },
  h1: { fontSize: 38, lineHeight: 1.05, margin: '4px 0 10px', textTransform: 'uppercase', fontWeight: 800 },
  lead: { fontSize: 16, lineHeight: 1.5, margin: '0 0 18px' },
  form: { display: 'flex', flexDirection: 'column', gap: 4 },
  bloque: { background: '#fff', borderRadius: 14, padding: 16, marginBottom: 10 },
  label: { display: 'block', fontSize: 15, fontWeight: 700, marginBottom: 8 },
  input: { width: '100%', padding: 12, fontSize: 16, border: `1px solid #c9d6d4`, borderRadius: 10, boxSizing: 'border-box', background: '#fff', color: PETROLEO },
  file: { fontSize: 15, width: '100%' },
  preview: { width: '100%', maxHeight: 220, objectFit: 'contain', marginTop: 10, borderRadius: 8, background: '#eee' },
  check: { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, lineHeight: 1.4, margin: '6px 0' },
  link: { background: 'none', border: 'none', padding: 0, color: TURQUESA, textDecoration: 'underline', font: 'inherit', cursor: 'pointer' },
  aviso: { background: '#fff', borderRadius: 10, padding: '4px 14px', fontSize: 13, lineHeight: 1.5, margin: '4px 0 8px' },
  btn: { background: CORAL, color: PETROLEO, border: 'none', borderRadius: 12, padding: 16, fontSize: 17, fontWeight: 800, cursor: 'pointer', width: '100%', marginTop: 10 },
  btnAlt: { display: 'block', textAlign: 'center', background: '#fff', color: PETROLEO, border: `1.5px solid ${PETROLEO}`, borderRadius: 12, padding: 14, fontWeight: 700, textDecoration: 'none' },
  btnTexto: { background: 'none', border: 'none', color: TURQUESA, textDecoration: 'underline', fontSize: 14, marginTop: 18, cursor: 'pointer', width: '100%' },
  letra: { fontSize: 12, lineHeight: 1.5, color: '#3d6b73', marginTop: 12 },
  dim: { fontSize: 14, color: '#3d6b73', margin: '6px 0 0' },
  dimC: { fontSize: 14, color: '#3d6b73', textAlign: 'center', marginBottom: 12 },
  ok: { fontSize: 14, color: '#1a6b3a', background: '#e3f3e8', padding: 10, borderRadius: 8, marginTop: 10 },
  warn: { fontSize: 14, color: '#7a5410', background: '#fdf1d8', padding: 10, borderRadius: 8, marginTop: 10 },
  err: { fontSize: 14, color: '#a1261b', background: '#fde8e4', padding: 12, borderRadius: 8, marginTop: 8 },
  cupon: { display: 'flex', gap: 14, alignItems: 'center', background: '#fff', borderRadius: 14, padding: 14, marginBottom: 12 },
  qr: { flex: 'none', width: 140, height: 140 },
  codigo: { fontSize: 22, fontWeight: 800, letterSpacing: 1, fontFamily: 'ui-monospace, monospace', color: TURQUESA },
  cuponTitulo: { fontSize: 16, fontWeight: 700, marginTop: 4, lineHeight: 1.3 },
  hr: { border: 'none', borderTop: '1px solid #d9cdb8', margin: '24px 0' },
  idiomas: { display: 'flex', gap: 6, justifyContent: 'flex-end', marginBottom: 14 },
  idioma: { minWidth: 44, minHeight: 36, padding: '6px 10px', borderRadius: 999, border: `1.5px solid ${PETROLEO}`, background: 'transparent', color: PETROLEO, fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  idiomaOn: { minWidth: 44, minHeight: 36, padding: '6px 10px', borderRadius: 999, border: `1.5px solid ${PETROLEO}`, background: PETROLEO, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
};
