'use client'

import { Check, Crown } from 'lucide-react'
import { PACKS, PAYMENTS } from '@/lib/afroclip'

export function Pricing({ onChoose }: { onChoose: (packId: string) => void }) {
  return (
    <section id="tarifs" className="relative overflow-hidden py-16">
      <div className="aurora pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
            Tarifs simples
          </span>
          <h2 className="mt-3 text-pretty text-3xl font-extrabold tracking-tight sm:text-4xl">
            Recharge, crée, deviens <span className="brand-gradient-text">viral</span>
          </h2>
          <p className="mt-2 text-muted-foreground">
            Paie une fois, dépense tes crédits quand tu veux. 1 crédit = 1 Short standard · 2 crédits
            = HD Pro sans filigrane.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3 md:items-center">
          {PACKS.map((p) => (
            <div
              key={p.id}
              className={`relative rounded-3xl border bg-card p-6 soft-shadow transition-transform ${
                p.featured
                  ? 'border-primary/40 md:-translate-y-3 md:scale-[1.03] brand-glow'
                  : 'border-border'
              }`}
            >
              {p.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full brand-gradient px-3 py-1 text-xs font-bold text-white">
                  {p.badge}
                </span>
              )}
              <div className="flex items-center gap-2">
                {p.featured && <Crown className="h-5 w-5 text-[var(--orange)]" />}
                <h3 className="text-lg font-extrabold">{p.name}</h3>
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold">{p.price.toLocaleString('fr-FR')}</span>
                <span className="text-sm font-semibold text-muted-foreground">FCFA</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {p.credits} crédits ·{' '}
                <span className="font-semibold text-foreground">{p.perCredit} F/crédit</span>
              </p>
              {p.bonus && <p className="mt-1 text-xs font-bold text-primary">{p.bonus}</p>}

              <ul className="mt-4 space-y-2 text-sm">
                {[
                  `${p.credits} crédits (jusqu'à ${p.credits} Shorts standard)`,
                  '1 crédit = standard · 2 crédits = HD Pro',
                  'Sans filigrane en Pro HD',
                  'Export TikTok / Reels / Shorts',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => onChoose(p.id)}
                className={`mt-5 flex h-12 w-full items-center justify-center rounded-2xl text-sm font-bold transition-transform hover:scale-[1.01] ${
                  p.featured
                    ? 'brand-gradient text-white brand-glow'
                    : 'border border-border bg-card text-foreground hover:border-primary/40'
                }`}
              >
                Choisir {p.name}
              </button>
            </div>
          ))}
        </div>

        {/* Moyens de paiement */}
        <div className="mx-auto mt-10 max-w-2xl rounded-3xl border border-border bg-card p-6 soft-shadow">
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Paiement local accepté
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            {PAYMENTS.map((m) => (
              <span
                key={m.name}
                className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm font-bold"
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-extrabold"
                  style={{ backgroundColor: m.color, color: m.fg }}
                  aria-hidden="true"
                >
                  {m.name.charAt(0)}
                </span>
                {m.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
