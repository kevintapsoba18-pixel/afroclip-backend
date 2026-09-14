'use client'

import { type FormEvent } from 'react'
import { ClipboardPaste, Play, Sparkles, Loader2 } from 'lucide-react'
import { DURATIONS, SUBTITLE_STYLES, SERVICE_TIERS, tierCost } from '@/lib/afroclip'

export function Generator({
  url,
  setUrl,
  duration,
  setDuration,
  styleId,
  setStyleId,
  tier,
  setTier,
  loading,
  error,
  onSubmit,
}: {
  url: string
  setUrl: (v: string) => void
  duration: string
  setDuration: (v: string) => void
  styleId: string
  setStyleId: (v: string) => void
  tier: string
  setTier: (v: string) => void
  loading: boolean
  error: string | null
  onSubmit: () => void
}) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!loading) onSubmit()
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      if (text.trim()) setUrl(text.trim())
    } catch {
      /* accès presse-papiers refusé — l'utilisateur peut coller manuellement */
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {/* Champ URL */}
      <div className="relative">
        <Play
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary"
          fill="currentColor"
        />
        <input
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Colle le lien YouTube ici…"
          aria-label="URL de la vidéo YouTube"
          aria-invalid={error ? true : undefined}
          className="h-14 w-full rounded-2xl border border-border bg-card pl-11 pr-28 text-base text-foreground outline-none soft-shadow ring-primary/40 transition focus:ring-2"
        />
        <button
          type="button"
          onClick={handlePaste}
          className="absolute right-2 top-1/2 flex h-10 -translate-y-1/2 items-center gap-1.5 rounded-xl bg-secondary px-3 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/70"
          aria-label="Coller le lien depuis le presse-papiers"
        >
          <ClipboardPaste className="h-4 w-4" />
          <span className="hidden sm:inline">Coller</span>
        </button>
      </div>

      {/* Options : durée + style de sous-titres */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-3 soft-shadow">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Durée du clip
          </p>
          <div className="grid grid-cols-3 gap-2">
            {DURATIONS.map((d) => {
              const active = duration === d.id
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDuration(d.id)}
                  aria-pressed={active}
                  className={`flex flex-col items-center rounded-xl px-2 py-2.5 text-center transition-all ${
                    active
                      ? 'brand-gradient text-white brand-glow'
                      : 'bg-muted text-foreground hover:bg-secondary'
                  }`}
                >
                  <span className="text-sm font-bold">{d.label}</span>
                  <span
                    className={`text-[11px] ${active ? 'text-white/80' : 'text-muted-foreground'}`}
                  >
                    {d.hint}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-3 soft-shadow">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Style de sous-titres
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SUBTITLE_STYLES.map((s) => {
              const active = styleId === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyleId(s.id)}
                  aria-pressed={active}
                  className={`rounded-xl px-3 py-2 text-left transition-all ${
                    active
                      ? 'bg-secondary ring-2 ring-primary'
                      : 'bg-muted hover:bg-secondary/60'
                  }`}
                >
                  <span className="block text-sm font-bold">{s.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{s.hint}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Niveau de service (coût en crédits) */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-3 soft-shadow">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Niveau de service
        </p>
        <div className="grid grid-cols-2 gap-2">
          {SERVICE_TIERS.map((t) => {
            const active = tier === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTier(t.id)}
                aria-pressed={active}
                className={`flex flex-col items-start rounded-xl px-3 py-2.5 text-left transition-all ${
                  active ? 'bg-secondary ring-2 ring-primary' : 'bg-muted hover:bg-secondary/60'
                }`}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-bold">{t.name}</span>
                  <span className="whitespace-nowrap rounded-full brand-gradient px-2 py-0.5 text-[10px] font-bold text-white">
                    {t.cost} {t.cost > 1 ? 'crédits' : 'crédit'}
                  </span>
                </span>
                <span className="mt-0.5 text-[11px] text-muted-foreground">{t.hint}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Bouton générer */}
      <button
        type="submit"
        disabled={loading}
        className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl brand-gradient text-base font-extrabold text-white brand-glow transition-transform hover:scale-[1.01] disabled:opacity-70"
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            L&apos;IA découpe ta vidéo…
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5" />
            Générer · −{tierCost(tier)} {tierCost(tier) > 1 ? 'crédits' : 'crédit'}
          </>
        )}
      </button>

      {error && (
        <p
          role="alert"
          aria-live="polite"
          className="mt-3 rounded-xl bg-destructive/10 px-4 py-2.5 text-center text-sm font-medium text-destructive"
        >
          {error}
        </p>
      )}
    </form>
  )
}
