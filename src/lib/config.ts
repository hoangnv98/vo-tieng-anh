export type AppConfig = { mode: 'local' } | { mode: 'supabase'; url: string; anonKey: string }

export function getConfig(): AppConfig {
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
  if (url && anonKey) return { mode: 'supabase', url, anonKey }
  return { mode: 'local' }
}
