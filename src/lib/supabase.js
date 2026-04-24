import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = "https://rtmtoyywvqadxkxadgkp.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0bXRveXl3dnFhZHhreGFkZ2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1ODg0MjYsImV4cCI6MjA5MTE2NDQyNn0.c30p6fYH8w4OVL1IOWPq4T6zGJAPqbGBXW9l3vmxhkc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ============================================================
// FIX: bug conocido de Supabase "tab refocus kills queries".
// Cuando la pestaña queda en segundo plano mucho tiempo, el
// cliente se congela y las queries nunca regresan respuesta.
// Solución: recargar la página cuando el usuario regresa tras
// estar oculto más de 30 segundos.
// ============================================================
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  let hiddenAt = null;
  const UMBRAL_MS = 30000; // 30 segundos

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
    } else if (document.visibilityState === 'visible' && hiddenAt !== null) {
      const ocultoPor = Date.now() - hiddenAt;
      hiddenAt = null;
      if (ocultoPor > UMBRAL_MS) {
        window.location.reload();
      }
    }
  });
}

// Catálogo de restaurantes (para mapear ids a nombres bonitos)
export const RESTAURANTES_INFO = {
  'el-nido': { nombre: 'El Nido', color: '#1a3a2e' },
  'soulbox': { nombre: 'Soulbox', color: '#2c3e50' },
  'bocamar': { nombre: 'Bocamar', color: '#c73e3a' },
  'leonessa': { nombre: 'Leonessa', color: '#c9962b' },
};

// Obtener el perfil del usuario actualmente autenticado
export async function obtenerPerfil() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) {
    console.error('Error al obtener perfil:', error);
    return null;
  }
  return data;
}
P
