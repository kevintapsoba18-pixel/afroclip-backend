'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { X, Mail, Lock, User, Loader2, Sparkles, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export type AuthMode = 'login' | 'signup'

export function AuthModal({
  open,
  mode,
  onClose,
  onModeChange,
  onAuthenticated,
}: {
  open: boolean
  mode: AuthMode
  onClose: () => void
  onModeChange: (m: AuthMode) => void
  onAuthenticated: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  // Fermer avec la touche Échap + bloquer le scroll de fond
  useEffect(() => {
    if (!open) return
    setError(null)
    setInfo(null)
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const isSignup = mode === 'signup'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    const supabase = createClient()

    try {
      if (isSignup) {
        // Création serveur (compte pré-confirmé) → accès immédiat aux crédits, sans email
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name: name.trim() }),
        })
        const payload = await res.json().catch(() => null)
        if (!res.ok) {
          setError(friendlyError(payload?.error ?? ''))
          return
        }
        // Connexion immédiate pour ouvrir la session
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signInErr) {
          setError(friendlyError(signInErr.message))
          return
        }
        onAuthenticated()
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          setError(friendlyError(error.message))
          return
        }
        onAuthenticated()
      }
    } catch {
      setError('Une erreur inattendue est survenue. Réessaie dans un instant.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-t-3xl border border-border bg-card p-6 soft-shadow sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-secondary"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        <div className="mb-5 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl brand-gradient text-white">
            <Sparkles className="h-6 w-6" />
          </span>
          <h2 id="auth-title" className="text-xl font-extrabold tracking-tight">
            {isSignup ? 'Crée ton compte AfroClip' : 'Content de te revoir'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignup
              ? 'Rejoins les créateurs et reçois 1 crédit offert.'
              : 'Connecte-toi pour retrouver tes vidéos et tes crédits.'}
          </p>
        </div>

        {info ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-secondary p-5 text-center">
            <CheckCircle2 className="h-8 w-8 text-primary" />
            <p className="text-sm font-medium text-foreground">{info}</p>
            <button
              onClick={() => onModeChange('login')}
              className="mt-1 text-sm font-bold text-primary hover:underline"
            >
              Revenir à la connexion
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {isSignup && (
              <Field
                icon={<User className="h-4 w-4" />}
                type="text"
                placeholder="Ton nom ou pseudo"
                value={name}
                onChange={setName}
                label="Nom"
                autoComplete="name"
              />
            )}
            <Field
              icon={<Mail className="h-4 w-4" />}
              type="email"
              placeholder="ton@email.com"
              value={email}
              onChange={setEmail}
              label="Email"
              autoComplete="email"
              required
            />
            <Field
              icon={<Lock className="h-4 w-4" />}
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={setPassword}
              label="Mot de passe"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              required
            />

            {error && (
              <p className="text-center text-sm font-semibold text-destructive" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl brand-gradient text-sm font-bold text-white brand-glow transition-transform hover:scale-[1.01] disabled:opacity-70"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isSignup ? (
                'Créer mon compte'
              ) : (
                'Se connecter'
              )}
            </button>
          </form>
        )}

        {!info && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {isSignup ? 'Tu as déjà un compte ?' : 'Pas encore de compte ?'}{' '}
            <button
              onClick={() => {
                setError(null)
                onModeChange(isSignup ? 'login' : 'signup')
              }}
              className="font-bold text-primary hover:underline"
            >
              {isSignup ? 'Se connecter' : "S'inscrire"}
            </button>
          </p>
        )}
      </div>
    </div>
  )
}

// Genericise le signal identifiants/existence, mais laisse passer ce sur quoi l'utilisateur doit agir
function friendlyError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('already registered') || m.includes('already exists') || m.includes('user already'))
    return 'Un compte existe déjà avec cet email. Connecte-toi.'
  if (m.includes('weak') || m.includes('at least') || m.includes('password should'))
    return 'Mot de passe trop faible : utilise au moins 6 caractères.'
  if (m.includes('rate') || m.includes('too many') || m.includes('limit'))
    return 'Trop de tentatives. Patiente un instant avant de réessayer.'
  if (m.includes('confirm')) return 'Confirme ton email via le lien reçu avant de te connecter.'
  return 'Email ou mot de passe invalide.'
}

function Field({
  icon,
  label,
  type,
  placeholder,
  value,
  onChange,
  autoComplete,
  required,
}: {
  icon: React.ReactNode
  label: string
  type: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
        <input
          type={type}
          required={required}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-12 w-full rounded-2xl border border-border bg-background pl-10 pr-4 text-base text-foreground outline-none ring-primary/40 transition focus:ring-2"
        />
      </div>
    </label>
  )
}
