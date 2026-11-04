// Vercel Serverless Function: lee la foto de un ticket con IA y devuelve los datos.
// Requiere la variable de entorno ANTHROPIC_API_KEY en Vercel.
// Si no está configurada, responde 501 y la página del cupón pasa a captura manual.

const MODELO = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';

const INSTRUCCIONES = `Eres un lector de tickets de restaurante en Isla Holbox, México.
Lee la foto y responde SOLO con un objeto JSON, sin texto adicional, con estas llaves:
{
  "legible": true|false,            // false si la foto está borrosa o no es un ticket
  "sistema": "soft_restaurant"|"leonessa"|"otro",
  "folio": "texto o null",          // Soft Restaurant: la línea FOLIO (ej. B24311). Leonessa: "Recibo #" (ej. 1-3925)
  "mesa": "texto o null",           // Soft Restaurant: la línea MESA tal cual (ej. 01.NELSON)
  "personas": número o null,        // Soft Restaurant: la línea PERSONAS
  "fecha": "AAAA-MM-DD o null",     // fecha del ticket (formato DD/MM/AAAA en México)
  "tiene_alimentos": true|false     // true si hay platillos de comida, no solo bebidas
}
No inventes datos: si algo no se lee, pon null.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const llave = process.env.ANTHROPIC_API_KEY;
  if (!llave) return res.status(501).json({ error: 'Lectura automática no configurada' });

  const { imagen } = req.body || {};
  if (!imagen || typeof imagen !== 'string' || imagen.length > 4_000_000) {
    return res.status(400).json({ error: 'Imagen inválida' });
  }
  const datos = imagen.replace(/^data:image\/\w+;base64,/, '');

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
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: datos } },
            { type: 'text', text: INSTRUCCIONES },
          ],
        }],
      }),
    });
    if (!r.ok) return res.status(502).json({ error: 'El lector no respondió' });
    const j = await r.json();
    const texto = (j.content || []).map((c) => c.text || '').join('');
    const json = JSON.parse(texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1));
    return res.status(200).json(json);
  } catch (e) {
    return res.status(502).json({ error: 'No se pudo leer el ticket' });
  }
}
