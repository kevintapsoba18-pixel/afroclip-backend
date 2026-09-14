import { createClient } from '@/lib/supabase/client'

// Backend externe (Railway) — appelé directement par le navigateur (CORS ouvert)
export const BACKEND_URL = 'https://afroclip-backend-production.up.railway.app'

// Réponse attendue du backend POST /api/process-video
export type ClipResult = {
  clipUrl: string
  title?: string
  thumbnail?: string
  subtitlesUrl?: string
  duration?: string
}

// Rend une URL absolue si le backend renvoie un chemin relatif (ex. /public/clip.mp4)
export function toAbsolute(u?: string): string | undefined {
  if (!u) return undefined
  return u.startsWith('http') ? u : `${BACKEND_URL}${u.startsWith('/') ? '' : '/'}${u}`
}

// Extrait l'identifiant (11 caractères) depuis tous les formats d'URL YouTube
export function extractYouTubeId(input: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/(?:shorts|live|embed)\/)([\w-]{11})/,
  ]
  for (const re of patterns) {
    const m = input.match(re)
    if (m) return m[1]
  }
  return null
}

// Durées de clip proposées
export const DURATIONS = [
  { id: '15', label: '15 s', hint: 'Punchy' },
  { id: '30', label: '30 s', hint: 'Équilibré' },
  { id: '60', label: '60 s', hint: 'Story' },
] as const

// Styles de sous-titres animés (façon TikTok / Reels)
export type SubtitleStyle = {
  id: string
  name: string
  hint: string
  // classes appliquées au mot mis en surbrillance
  activeClass: string
  baseClass: string
}

export const SUBTITLE_STYLES: SubtitleStyle[] = [
  {
    id: 'karaoke',
    name: 'Karaoké',
    hint: 'Mot en surbrillance jaune',
    baseClass: 'text-white',
    activeClass: 'text-[#facc15]',
  },
  {
    id: 'neon',
    name: 'Néon',
    hint: 'Glow violet/rose',
    baseClass: 'text-white/85',
    activeClass: 'text-[#ec4899] drop-shadow-[0_0_10px_rgba(236,72,153,0.9)]',
  },
  {
    id: 'bold',
    name: 'Gras Blanc',
    hint: 'Classique lisible',
    baseClass: 'text-white/70',
    activeClass: 'text-white',
  },
  {
    id: 'pop',
    name: 'Pop Orange',
    hint: 'Énergique',
    baseClass: 'text-white/80',
    activeClass: 'text-[#f97316]',
  },
]

// Phrase de démonstration pour l'animation des sous-titres
export const DEMO_CAPTION = [
  'Voici',
  'comment',
  'devenir',
  'viral',
  'en',
  'moins',
  'de',
  '30',
  'secondes',
]

// Packs de crédits (1 crédit = 1 clip HD sans filigrane)
export type Pack = {
  id: string
  name: string
  price: number
  credits: number
  perCredit: number
  bonus?: string
  badge?: string
  featured?: boolean
}

export const PACKS: Pack[] = [
  { id: 'decouverte', name: 'Découverte', price: 1000, credits: 5, perCredit: 200 },
  {
    id: 'createur',
    name: 'Créateur',
    price: 2500,
    credits: 15,
    perCredit: 167,
    bonus: '+13% de crédits',
    badge: 'Best-Seller',
    featured: true,
  },
  {
    id: 'studio',
    name: 'Studio',
    price: 5000,
    credits: 35,
    perCredit: 143,
    bonus: '+40% de crédits',
    badge: 'Meilleure valeur',
  },
]

// Niveaux de service choisis au moment de coller le lien (coût variable en crédits)
export type ServiceTier = {
  id: string
  name: string
  cost: number
  hint: string
  features: string[]
}

export const SERVICE_TIERS: ServiceTier[] = [
  {
    id: 'standard',
    name: 'Standard',
    cost: 1,
    hint: 'Vertical 720p · sous-titres animés',
    features: ['1 Short vertical', 'Sous-titres animés', 'Qualité web 720p'],
  },
  {
    id: 'pro',
    name: 'Pro HD',
    cost: 2,
    hint: 'HD 1080p · sans filigrane · prioritaire',
    features: ['HD 1080p sans filigrane', 'Sous-titres premium', 'Recadrage intelligent + priorité'],
  },
]

export function tierCost(id: string): number {
  return SERVICE_TIERS.find((t) => t.id === id)?.cost ?? 1
}

// Moyens de paiement locaux
export const PAYMENTS = [
  { name: 'Orange Money', color: '#ff7900', fg: '#ffffff' },
  { name: 'MTN MoMo', color: '#ffcc00', fg: '#1e1b2e' },
  { name: 'Moov Money', color: '#0066b3', fg: '#ffffff' },
  { name: 'Wave', color: '#1dc4ff', fg: '#1e1b2e' },
  { name: 'Carte bancaire', color: '#7c3aed', fg: '#ffffff' },
]

// Télécharge le fichier MP4 renvoyé par l'API (via blob = vrai téléchargement, pas un simple onglet)
export async function downloadClip(clip: ClipResult): Promise<void> {
  const res = await fetch(clip.clipUrl)
  if (!res.ok) throw new Error('Téléchargement impossible.')
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  const safeTitle = (clip.title ?? 'afroclip-short').replace(/[^a-z0-9-]+/gi, '-').toLowerCase()
  a.download = `${safeTitle}-${Date.now()}.mp4`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Laisse le temps au navigateur de démarrer le téléchargement avant de révoquer
  setTimeout(() => URL.revokeObjectURL(objectUrl), 4000)
}

// Crée une facture PayDunya côté backend et redirige vers la page de paiement (paymentUrl).
// Transmet le montant exact (total_amount), la description et les custom_data attendus par
// le webhook PayDunya pour créditer le bon utilisateur après paiement.
export async function createPaydunyaCheckout(
  pack: Pack,
  opts: { userId: string; method?: string },
): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/paydunya/create-invoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      total_amount: pack.price,
      amount: pack.price,
      currency: 'XOF',
      description: `AfroClip.ai — Pack ${pack.name} (${pack.credits} crédits)`,
      payment_method: opts.method,
      // PayDunya doit notifier notre serveur pour créditer le compte après paiement
      callback_url:
        typeof window !== 'undefined'
          ? `${window.location.origin}/api/paydunya/webhook`
          : undefined,
      custom_data: {
        user_id: opts.userId,
        credits_to_add: pack.credits,
        pack_id: pack.id,
      },
    }),
  })
  const data = await res.json().catch(() => null)
  const paymentUrl = data?.paymentUrl
  if (!res.ok || !paymentUrl) {
    throw new Error(data?.error ?? 'Impossible de créer le paiement PayDunya. Réessaie.')
  }
  // Dans l'aperçu v0 (iframe), on ouvre un nouvel onglet ; sinon redirection directe
  if (typeof window !== 'undefined' && window.self !== window.top) {
    window.open(paymentUrl, '_blank', 'noopener,noreferrer')
  } else {
    window.location.href = paymentUrl
  }
}

// ---- Génération (via notre route serveur qui gère crédits + proxy backend) ----

export type GenerateInput = {
  url: string
  duration: string
  subtitleStyle: string
  tier: string
}

export type GenerateResult =
  | { ok: true; clip: ClipResult; credits: number }
  | {
      ok: false
      code: 'unauthenticated' | 'insufficient_credits' | 'invalid_url' | 'processing_failed' | 'network'
      error: string
      credits?: number
    }

export async function generateClip(input: GenerateInput): Promise<GenerateResult> {
  try {
    const res = await fetch('/api/process-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    const data = await res.json().catch(() => null)

    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        code: data?.code ?? 'processing_failed',
        error: data?.error ?? 'La génération a échoué. Réessaie.',
        credits: typeof data?.credits === 'number' ? data.credits : undefined,
      }
    }

    const raw = data.clip
    const clip: ClipResult = {
      ...raw,
      clipUrl: toAbsolute(raw.clipUrl)!,
      thumbnail: toAbsolute(raw.thumbnail),
      subtitlesUrl: toAbsolute(raw.subtitlesUrl),
      duration: raw.duration ?? `${input.duration}s`,
    }
    return { ok: true, clip, credits: data.credits }
  } catch {
    return {
      ok: false,
      code: 'network',
      error: 'Connexion impossible au serveur. Vérifie ta connexion et réessaie.',
    }
  }
}

// ---- Authentification & crédits (Supabase) ----

export type SessionUser = { id: string; email: string; name: string }

// Récupère l'utilisateur connecté (token validé côté serveur Supabase)
export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return {
    id: user.id,
    email: user.email ?? '',
    name: (user.user_metadata?.name as string) || user.email?.split('@')[0] || 'Créateur',
  }
}

// Garantit explicitement une ligne dans public.users pour l'utilisateur connecté,
// en appelant l'endpoint serveur (insertion via service-role si absente).
// Renvoie le solde de crédits, ou null si l'appel échoue. Les erreurs sont loguées en console.
export async function ensureUserRow(): Promise<number | null> {
  try {
    const res = await fetch('/api/auth/ensure-user', { method: 'POST' })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      console.error('[v0] ensure-user a échoué:', res.status, payload?.error ?? '(sans détail)')
      return null
    }
    return typeof payload?.credits === 'number' ? payload.credits : null
  } catch (e) {
    console.error('[v0] ensure-user erreur réseau:', e instanceof Error ? e.message : e)
    return null
  }
}

// Lit le solde de crédits de l'utilisateur AUTHENTIFIÉ.
// L'ID est toujours dérivé de la session (supabase.auth.getUser()) : jamais un ID fixe ou factice.
// On garantit d'abord la présence de la ligne via ensureUserRow() (source de vérité serveur),
// puis on complète par une lecture directe .select('credits').eq('id', user.id).single() en secours.
export async function fetchCredits(userId?: string): Promise<number> {
  // 1) Appel explicite : crée la ligne si besoin et renvoie le solde autoritatif
  const ensured = await ensureUserRow()
  if (ensured !== null) return ensured

  // 2) Secours : lecture directe scoped à l'utilisateur connecté (RLS: auth.uid() = id)
  const supabase = createClient()
  let id = userId
  if (!id) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return 0
    id = user.id
  }
  const { data } = await supabase
    .from('users')
    .select('credits')
    .eq('id', id)
    .maybeSingle()
  return data?.credits ?? 0
}

export async function signOut(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()
}

// Abonnement temps réel au solde de crédits de l'utilisateur.
// Déclenche onChange à chaque UPDATE de sa ligne dans public.users (RLS: auth.uid() = id).
// Renvoie une fonction de nettoyage pour se désabonner.
export function subscribeToCredits(
  userId: string,
  onChange: (credits: number) => void,
): () => void {
  const supabase = createClient()
  const channel = supabase
    .channel(`credits:${userId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
      (payload) => {
        const next = (payload.new as { credits?: number } | null)?.credits
        if (typeof next === 'number') onChange(next)
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
