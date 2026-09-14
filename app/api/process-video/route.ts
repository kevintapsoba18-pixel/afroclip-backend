import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractYouTubeId, tierCost } from '@/lib/afroclip'

// URL du backend de traitement (serveur → serveur, donc pas de souci CORS et l'URL vient de l'env)
const BACKEND = process.env.BACKEND_URL ?? 'https://afroclip-backend-production.up.railway.app'

export async function POST(req: Request) {
  const { url, duration, subtitleStyle, tier } = await req
    .json()
    .catch(() => ({}) as Record<string, string>)

  if (!url || !extractYouTubeId(url)) {
    return NextResponse.json(
      { code: 'invalid_url', error: 'Lien YouTube invalide. Colle le lien complet de la vidéo.' },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'unauthenticated', error: 'Connecte-toi pour générer un Short.' },
      { status: 401 },
    )
  }

  const cost = tierCost(tier)
  const admin = createAdminClient()

  // Débit atomique et sécurisé (refuse si le solde est insuffisant)
  const { data: balance, error: spendErr } = await admin.rpc('spend_credits', {
    p_user: user.id,
    p_amount: cost,
  })
  if (spendErr) {
    return NextResponse.json(
      {
        code: 'insufficient_credits',
        error: `Crédits insuffisants : ce niveau coûte ${cost} crédit(s). Recharge à partir de 1 000 FCFA.`,
      },
      { status: 402 },
    )
  }

  try {
    const res = await fetch(`${BACKEND}/api/process-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        youtubeUrl: url,
        duration: Number(duration),
        subtitleStyle,
        tier,
        options: { duration: Number(duration), subtitleStyle, tier },
      }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.clipUrl) {
      throw new Error(data?.error ?? 'processing failed')
    }

    await admin.from('credit_transactions').insert({ user_id: user.id, amount: -cost, kind: 'spend' })

    return NextResponse.json({ ok: true, clip: data, credits: balance })
  } catch {
    // Remboursement automatique si le traitement échoue : l'utilisateur ne perd jamais de crédit
    const { data: refunded } = await admin.rpc('add_credits', { p_user: user.id, p_amount: cost })
    return NextResponse.json(
      {
        code: 'processing_failed',
        error: 'Le traitement de la vidéo a échoué. Tes crédits ont été remboursés — réessaie.',
        credits: refunded ?? balance,
      },
      { status: 502 },
    )
  }
}
