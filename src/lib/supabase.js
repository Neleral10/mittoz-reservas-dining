import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = "https://rtmtoyywvqadxkxadgkp.supabase.co";
export const SUPABASE_KEY = "sb_publishable_klEi5wIiMg6zELDUAJ24vw_ZHDbCFzA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: async (name, acquireTimeout, fn) => {
      return await fn();
    },
  },
});

export const RESTAURANTES_INFO = {
  'el-nido': { nombre: 'El Nido', color: '#1a3a2e' },
  'soulbox': { nombre: 'Soulbox', color: '#2c3e50' },
  'bocamar': { nombre: 'Bocamar', color: '#c73e3a' },
  'leonessa': { nombre: 'Leonessa', color: '#c9962b' },
};

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
