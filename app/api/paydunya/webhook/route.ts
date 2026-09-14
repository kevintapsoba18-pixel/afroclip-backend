import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// PayDunya IPN — crédite le compte après un paiement confirmé. Idempotent grâce à la
// colonne `reference` unique de public.credit_transactions (aucun double crédit possible).
export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') ?? ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payload: any = null
  try {
    if (contentType.includes('application/json')) {
      payload = await req.json()
    } else {
      const form = await req.formData()
      payload = Object.fromEntries(form.entries())
      if (typeof payload.data === 'string') payload = JSON.parse(payload.data)
    }
  } catch {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  const invoice = payload?.invoice ?? payload ?? {}
  const status = String(payload?.status ?? invoice?.status ?? '').toLowerCase()
  const custom = payload?.custom_data ?? invoice?.custom_data ?? {}
  const reference =
    invoice?.token ?? payload?.token ?? invoice?.receipt_url ?? payload?.receipt_url ?? null

  // On ne crédite que les paiements aboutis
  if (status && !['completed', 'success', 'succeeded', 'paid'].includes(status)) {
    return NextResponse.json({ ignored: true })
  }

  const userId = custom?.user_id
  const credits = Number(custom?.credits_to_add)
  if (!userId || !credits || credits <= 0) {
    return NextResponse.json({ error: 'missing custom_data' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Idempotence : une reference déjà vue déclenche une erreur d'unicité → on renvoie un succès
  const ref = reference ?? `${userId}:${custom?.pack_id ?? 'pack'}:${credits}`
  const { error: insertErr } = await admin
    .from('credit_transactions')
    .insert({ user_id: userId, amount: credits, kind: 'purchase', reference: ref })
  if (insertErr) {
    return NextResponse.json({ ok: true, alreadyProcessed: true })
  }

  await admin.rpc('add_credits', { p_user: userId, p_amount: credits })
  return NextResponse.json({ ok: true })
}
