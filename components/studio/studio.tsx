'use client'

import { useCallback, useEffect, useState } from 'react'
import { Sparkles, Zap, ShieldCheck } from 'lucide-react'
import {
  extractYouTubeId,
  downloadClip,
  generateClip,
  tierCost,
  getCurrentUser,
  fetchCredits,
  subscribeToCredits,
  signOut,
  type ClipResult,
  type SessionUser,
} from '@/lib/afroclip'
import { StudioHeader } from './studio-header'
import { Generator } from './generator'
import { VideoPreview } from './video-preview'
import { Dashboard } from './dashboard'
import { Pricing } from './pricing'
import { PaymentModal } from './payment-modal'
import { AuthModal, type AuthMode } from './auth-modal'

export function Studio() {
  const [url, setUrl] = useState('')
  const [duration, setDuration] = useState('30')
  const [styleId, setStyleId] = useState('karaoke')
  const [tier, setTier] = useState('standard')
  const cost = tierCost(tier)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clip, setClip] = useState<ClipResult | null>(null)
  const [history, setHistory] = useState<ClipResult[]>([])
  const [downloading, setDownloading] = useState(false)

  // Freemium
  const [credits, setCredits] = useState(0)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [paywallReason, setPaywallReason] = useState<'download' | 'limit'>('download')
  const [paywallPack, setPaywallPack] = useState<string | undefined>(undefined)

  // Authentification (session Supabase)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('signup')
  const [refreshing, setRefreshing] = useState(false)

  // Recharge la session + le solde de crédits directement depuis Supabase
  const refreshCredits = useCallback(async () => {
    const current = await getCurrentUser()
    setUser(current)
    setCredits(current ? await fetchCredits(current.id) : 0)
  }, [])

  // Rafraîchissement manuel léger : une seule requête sur les crédits (pas de re-validation de session)
  async function refreshCreditsOnly() {
    if (!user || refreshing) return
    setRefreshing(true)
    try {
      setCredits(await fetchCredits(user.id))
    } finally {
      setRefreshing(false)
    }
  }

  // Au chargement de la page ET à chaque fois que la fenêtre reprend le focus
  useEffect(() => {
    refreshCredits()
    const onFocus = () => refreshCredits()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshCredits])

  // Solde en temps réel : mise à jour automatique du header à chaque changement en base
  useEffect(() => {
    if (!user) return
    const unsubscribe = subscribeToCredits(user.id, (next) => setCredits(next))
    return unsubscribe
  }, [user])

  function openPaywall(reason: 'download' | 'limit', packId?: string) {
    setPaywallReason(reason)
    setPaywallPack(packId)
    setPaywallOpen(true)
  }

  function openAuth(mode: AuthMode) {
    setAuthMode(mode)
    setAuthOpen(true)
  }

  async function handleAuthenticated() {
    setAuthOpen(false)
    await refreshCredits()
  }

  async function handleLogout() {
    await signOut()
    setUser(null)
    setCredits(0)
  }

  async function generate() {
    setError(null)

    if (!extractYouTubeId(url)) {
      setError('Ce lien n’est pas une URL YouTube valide. Colle le lien complet de la vidéo.')
      return
    }

    // Il faut un compte : le solde de crédits fait autorité côté serveur
    if (!user) {
      openAuth('signup')
      return
    }

    if (credits < cost) {
      openPaywall('limit')
      return
    }

    setLoading(true)
    setClip(null)
    const result = await generateClip({ url, duration, subtitleStyle: styleId, tier })
    setLoading(false)

    if (!result.ok) {
      if (result.code === 'unauthenticated') {
        openAuth('login')
        return
      }
      if (typeof result.credits === 'number') setCredits(result.credits)
      if (result.code === 'insufficient_credits') {
        openPaywall('limit')
        return
      }
      setError(result.error)
      return
    }

    setClip(result.clip)
    setHistory((h) => [result.clip, ...h])
    setCredits(result.credits)
  }

  // Téléchargement direct du fichier MP4 renvoyé par l'API (aperçu avec filigrane, gratuit)
  async function handleDownload() {
    if (!clip) return
    setError(null)
    setDownloading(true)
    try {
      await downloadClip(clip)
    } catch {
      setError('Le téléchargement a échoué. Réessaie dans un instant.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div id="top" className="min-h-dvh">
      <StudioHeader
        credits={credits}
        user={user?.name ?? null}
        refreshing={refreshing}
        onRefresh={user ? refreshCreditsOnly : undefined}
        onRecharge={() => (user ? openPaywall('download') : openAuth('login'))}
        onLogin={() => openAuth('login')}
        onSignup={() => openAuth('signup')}
        onLogout={handleLogout}
      />

      {/* Hero + Studio */}
      <section className="relative overflow-hidden">
        <div className="aurora pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4 pb-6 pt-10 sm:pt-14">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-secondary-foreground soft-shadow">
              <Sparkles className="h-3.5 w-3.5 text-[var(--orange)]" />
              Le studio IA n°1 pour les créateurs africains
            </span>
            <h1 className="mt-4 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              Transforme tes vidéos YouTube en{' '}
              <span className="brand-gradient-text">Shorts viraux</span>
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
              Colle un lien, l&apos;IA découpe, sous-titre et recadre automatiquement. Prêt pour
              TikTok, Reels et Shorts en quelques secondes.
            </p>
          </div>

          <div className="mx-auto mt-8 grid max-w-5xl items-start gap-6 lg:grid-cols-[1fr_320px]">
            {/* Colonne gauche : générateur */}
            <div className="rounded-3xl border border-border bg-card/70 p-4 backdrop-blur soft-shadow sm:p-6">
              <Generator
                url={url}
                setUrl={setUrl}
                duration={duration}
                setDuration={setDuration}
                styleId={styleId}
                setStyleId={setStyleId}
                tier={tier}
                setTier={setTier}
                loading={loading}
                error={error}
                onSubmit={generate}
              />

              {/* Réassurance */}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-[var(--orange)]" />
                  1 crédit offert
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  Sans carte bancaire
                </span>
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--pink)]" />
                  Sous-titres animés
                </span>
              </div>
            </div>

            {/* Colonne droite : aperçu */}
            <div className="lg:sticky lg:top-20">
              {clip ? (
                <VideoPreview
                  clip={clip}
                  styleId={styleId}
                  downloading={downloading}
                  onDownload={handleDownload}
                  onUpgrade={() => openPaywall('download')}
                  onRegenerate={generate}
                />
              ) : (
                <div className="mx-auto flex aspect-[9/16] w-full max-w-[300px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/60 px-6 text-center soft-shadow">
                  <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl brand-gradient text-white">
                    <Sparkles className="h-7 w-7" />
                  </span>
                  <p className="font-bold">Ton Short apparaîtra ici</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Lecteur vertical avec sous-titres animés et aperçu instantané.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <Dashboard history={history} onOpen={(c) => setClip(c)} />

      <Pricing onChoose={(packId) => openPaywall('download', packId)} />

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center">
          <span className="text-lg font-extrabold">
            AfroClip<span className="brand-gradient-text">.ai</span>
          </span>
          <p className="text-sm text-muted-foreground">
            Le studio IA qui transforme tes vidéos en Shorts viraux. Fait pour l&apos;Afrique
            francophone.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            © {new Date().getFullYear()} AfroClip.ai — Tous droits réservés
          </p>
        </div>
      </footer>

      <PaymentModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        reason={paywallReason}
        initialPack={paywallPack}
        userId={user?.id ?? null}
        onRequireAuth={() => {
          setPaywallOpen(false)
          openAuth('login')
        }}
      />

      <AuthModal
        open={authOpen}
        mode={authMode}
        onClose={() => setAuthOpen(false)}
        onModeChange={setAuthMode}
        onAuthenticated={handleAuthenticated}
      />
    </div>
  )
}
