import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = "https://rtmtoyywvqadxkxadgkp.supabase.co";
export const SUPABASE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0bXRveXl3dnFhZHhreGFkZ2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1ODg0MjYsImV4cCI6MjA5MTE2NDQyNn0.c30p6fYH8w4OVL1IOWPq4T6zGJAPqbGBXW9l3vmxhkc

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

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
