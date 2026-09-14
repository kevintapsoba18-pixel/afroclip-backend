import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Garantit qu'une ligne existe dans public.users pour l'utilisateur connecté.
// La session est validée côté serveur (on ne fait jamais confiance à un id envoyé par le client).
// Insertion via service-role car la table users n'autorise pas l'INSERT côté client (RLS).
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const admin = createAdminClient()

  // La ligne existe-t-elle déjà ?
  const { data: existing } = await admin
    .from('users')
    .select('credits')
    .eq('id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, created: false, credits: existing.credits ?? 0 })
  }

  // Absente → on l'insère (credits à 0 par défaut ; le bonus d'inscription est géré par le trigger)
  const { data: inserted, error } = await admin
    .from('users')
    .insert({ id: user.id, email: user.email, credits: 0 })
    .select('credits')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true, created: true, credits: inserted.credits ?? 0 })
}
