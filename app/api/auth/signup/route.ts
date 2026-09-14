import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Inscription serveur : crée un compte DÉJÀ confirmé (email_confirm: true) pour un accès
// immédiat aux crédits, sans étape d'email. Le trigger on_auth_user_created offre 1 crédit.
export async function POST(req: Request) {
  const { email, password, name } = await req.json().catch(() => ({}) as Record<string, string>)

  if (!email || !password) {
    return NextResponse.json({ error: 'Email et mot de passe requis.' }, { status: 400 })
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: 'password should be at least 6 characters' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: (name as string)?.trim() || String(email).split('@')[0] },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
