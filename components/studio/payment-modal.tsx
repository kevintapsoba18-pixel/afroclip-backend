'use client'

import { useEffect, useState } from 'react'
import { X, Check, Sparkles, ShieldCheck, Loader2 } from 'lucide-react'
import { PACKS, PAYMENTS, createPaydunyaCheckout } from '@/lib/afroclip'

export function PaymentModal({
  open,
  onClose,
  reason,
  initialPack,
  userId,
  onRequireAuth,
}: {
  open: boolean
  onClose: () => void
  reason: 'download' | 'limit'
  initialPack?: string
  userId: string | null
  onRequireAuth: () => void
}) {
  const [pack, setPack] = useState('createur')
  const [payment, setPayment] = useState('Wave')
  const [processing, setProcessing] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const selectedPack = PACKS.find((p) => p.id === pack)

  // Pré-sélectionne le pack choisi depuis la grille tarifaire à l'ouverture
  useEffect(() => {
    if (open && initialPack) setPack(initialPack)
  }, [open, initialPack])

  useEffect(() => {
    if (!open) return
    setPayError(null)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  async function handlePay() {
    if (!selectedPack) return
    // Le paiement doit être lié à un utilisateur pour créditer le bon compte
    if (!userId) {
      onRequireAuth()
      return
    }
    setPayError(null)
    setProcessing(true)
    try {
      await createPaydunyaCheckout(selectedPack, { userId, method: payment })
      // La redirection PayDunya prend le relais ; on ferme la modale
      onClose()
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Le paiement a échoué. Réessaie.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choisir un pack de crédits"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-5 sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          {reason === 'download' ? 'Débloque le HD sans filigrane' : 'Aperçu gratuit utilisé'}
        </div>
        <h2 className="text-pretty text-2xl font-extrabold tracking-tight">
          Recharge tes crédits et exporte en HD
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          1 crédit = 1 Short standard · 2 crédits = HD Pro sans filigrane, prêt pour TikTok et Reels.
        </p>

        {/* Packs */}
        <div className="mt-5 space-y-2.5">
          {PACKS.map((p) => {
            const active = pack === p.id
            return (
              <button
                key={p.id}
                onClick={() => setPack(p.id)}
                aria-pressed={active}
                className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all ${
                  active
                    ? 'border-primary bg-secondary ring-2 ring-primary'
                    : 'border-border bg-card hover:border-primary/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                      active ? 'border-primary bg-primary text-white' : 'border-border'
                    }`}
                  >
                    {active && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{p.name}</span>
                      {p.badge && (
                        <span className="rounded-full brand-gradient px-2 py-0.5 text-[10px] font-bold text-white">
                          {p.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {p.credits} crédits · {p.perCredit} F/crédit
                    </span>
                  </div>
                </div>
                <span className="text-right">
                  <span className="block text-lg font-extrabold">
                    {p.price.toLocaleString('fr-FR')}
                  </span>
                  <span className="block text-xs text-muted-foreground">FCFA</span>
                </span>
              </button>
            )
          })}
        </div>

        {/* Moyens de paiement */}
        <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Payer avec
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {PAYMENTS.map((m) => {
            const active = payment === m.name
            return (
              <button
                key={m.name}
                onClick={() => setPayment(m.name)}
                aria-pressed={active}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition-all ${
                  active ? 'border-primary bg-secondary' : 'border-border bg-card hover:border-primary/40'
                }`}
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-extrabold"
                  style={{ backgroundColor: m.color, color: m.fg }}
                  aria-hidden="true"
                >
                  {m.name.charAt(0)}
                </span>
                <span className="text-[10px] font-semibold leading-tight">{m.name}</span>
              </button>
            )
          })}
        </div>

        {/* CTA */}
        <button
          onClick={handlePay}
          disabled={processing}
          className="mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-2xl brand-gradient py-3.5 text-base font-extrabold text-white brand-glow transition-transform hover:scale-[1.01] disabled:opacity-70"
        >
          {processing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Redirection vers PayDunya…
            </>
          ) : (
            <>Payer {selectedPack?.price.toLocaleString('fr-FR')} FCFA via {payment}</>
          )}
        </button>
        {payError && (
          <p className="mt-2 text-center text-xs font-semibold text-destructive" role="alert">
            {payError}
          </p>
        )}
        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Paiement sécurisé via PayDunya — Mobile Money & carte bancaire
        </p>
      </div>
    </div>
  )
}
