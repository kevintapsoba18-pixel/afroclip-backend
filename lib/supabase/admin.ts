import { createClient } from '@supabase/supabase-js'

// Client service-role (serveur uniquement) — bypass RLS pour créditer/débiter en toute sécurité.
// Ne jamais importer ce fichier depuis un composant client.
export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
