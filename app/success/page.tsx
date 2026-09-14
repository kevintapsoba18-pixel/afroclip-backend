'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Coins, ArrowRight, Loader2, Sparkles } from 'lucide-react'
import { fetchCredits, getCurrentUser } from '@/lib/afroclip'

export default function SuccessPage() {
  const [status, setStatus] = useState<'loading' | 'authed' | 'anon'>('loading')
  const [credits, setCredits] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      const user = await getCurrentUser()
      if (!active) return
      if (!user) {
        setStatus('anon')
        return
      }
      setStatus('authed')
      // Rafraîchit le solde réel depuis Supabase (garantit la ligne + lecture .select('credits'))
      const balance = await fetchCredits(user.id)
      if (active) setCredits(balance)
    })()
    return () => {
      active = false
    }
  }, [])

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-7 text-center soft-shadow">
        {/* Pastille de succès */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full brand-gradient brand-glow">
          <Check className="h-10 w-10 text-white" strokeWidth={3} />
        </div>

        <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-balance">
          Paiement réussi !
        </h1>
        <p className="mt-2 text-pretty text-muted-foreground leading-relaxed">
          Merci pour ton achat. Tes crédits ont été ajoutés à ton compte et sont prêts à générer tes
          prochains Shorts.
        </p>

        {/* Solde de crédits rafraîchi depuis Supabase */}
        <div className="mt-6 flex items-center justify-center gap-2.5 rounded-2xl border border-border bg-muted px-4 py-4">
          <Coins className="h-5 w-5 text-[var(--orange)]" />
          {status === 'loading' || (status === 'authed' && credits === null) ? (
            <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Mise à jour du solde…
            </span>
          ) : status === 'anon' ? (
            <span className="text-sm font-medium text-muted-foreground">
              Connecte-toi pour voir ton solde
            </span>
          ) : (
            <span className="text-sm font-semibold">
              Nouveau solde :{' '}
              <span className="text-base font-extrabold tabular-nums text-foreground">
                {credits}
              </span>{' '}
              crédit{(credits ?? 0) > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Retour instantané au studio */}
        <Link
          href="/"
          className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl brand-gradient text-base font-extrabold text-white brand-glow transition-transform hover:scale-[1.01]"
        >
          <Sparkles className="h-5 w-5" />
          Retour au studio
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    </main>
  )
}
