// Vercel Serverless Function: lee la foto de un ticket con IA y devuelve los datos.
// Requiere la variable de entorno ANTHROPIC_API_KEY en Vercel.
// Si no está configurada, responde 501 y la página del cupón pasa a captura manual.

const MODELO = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';

const INSTRUCCIONES = `Eres un lector de tickets de restaurante en Isla Holbox, México.
Lee la foto y responde ÚNICAMENTE con un objeto JSON válido, sin comentarios, sin texto antes ni después y sin bloques de código.
Llaves y significado:
- legible: true o false. false si la foto está borrosa o no es un ticket.
- sistema: "soft_restaurant", "leonessa" u "otro". Soft Restaurant trae líneas MESA, MESERO, PERSONAS y FOLIO. Leonessa trae "Recibo #".
- folio: texto o null. Soft Restaurant: el valor de la línea FOLIO (ej. B24311). Leonessa: el valor de "Recibo #" (ej. 1-3925).
- mesa: texto o null. Soft Restaurant: el valor de la línea MESA tal cual, con su punto si lo tiene (ej. 01.NELSON).
- personas: número o null. Soft Restaurant: el valor de la línea PERSONAS.
- fecha: "AAAA-MM-DD" o null. Las fechas del ticket vienen como DD/MM/AAAA.
- tiene_alimentos: true si hay platillos de comida, false si solo hay bebidas.
No inventes datos: si algo no se lee, usa null.
Ejemplo de respuesta: {"legible":true,"sistema":"soft_restaurant","folio":"B24311","mesa":"01.NELSON","personas":3,"fecha":"2026-11-03","tiene_alimentos":true}`;

// Saca el primer objeto JSON de la respuesta aunque venga con texto, comentarios o ```json
function extraerJSON(texto) {
  const limpio = texto.replace(/```(?:json)?/gi, '').replace(/\/\/[^\n"]*$/gm, '');
  const ini = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');
  if (ini < 0 || fin <= ini) throw new Error('sin JSON');
  return JSON.parse(limpio.slice(ini, fin + 1));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const llave = process.env.ANTHROPIC_API_KEY;
  if (!llave) return res.status(501).json({ error: 'Lectura automática no configurada' });

  const { imagen } = req.body || {};
  if (!imagen || typeof imagen !== 'string' || imagen.length > 4_000_000) {
    return res.status(400).json({ error: 'Imagen inválida' });
  }
  const tipo = (imagen.match(/^data:(image\/\w+);base64,/) || [])[1] || 'image/jpeg';
  const datos = imagen.replace(/^data:image\/\w+;base64,/, '');

  let texto = '';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': llave,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: tipo, data: datos } },
            { type: 'text', text: INSTRUCCIONES },
          ],
        }],
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('leer-ticket API', r.status, JSON.stringify(j).slice(0, 500));
      return res.status(502).json({ error: 'El lector no respondió', detalle: j?.error?.type || r.status });
    }
    texto = (j.content || []).map((c) => c.text || '').join('');
    return res.status(200).json(extraerJSON(texto));
  } catch (e) {
    console.error('leer-ticket', e.message, texto.slice(0, 300));
    return res.status(502).json({ error: 'No se pudo leer el ticket', detalle: e.message });
  }
}
