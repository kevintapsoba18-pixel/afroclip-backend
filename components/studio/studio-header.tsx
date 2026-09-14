'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { Coins, Plus, RefreshCw, LogOut, ChevronDown } from 'lucide-react'

export function StudioHeader({
  credits,
  user,
  refreshing,
  onRefresh,
  onRecharge,
  onLogin,
  onSignup,
  onLogout,
}: {
  credits: number
  user: string | null
  refreshing?: boolean
  onRefresh?: () => void
  onRecharge: () => void
  onLogin: () => void
  onSignup: () => void
  onLogout: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fermeture du menu au clic extérieur
  useEffect(() => {
    if (!menuOpen) return
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="relative h-9 w-9 overflow-hidden rounded-xl ring-1 ring-border">
            <Image
              src="/afroclip-logo.jpeg"
              alt="Logo AfroClip.ai"
              fill
              className="object-cover"
              sizes="36px"
            />
          </span>
          <span className="text-lg font-extrabold tracking-tight">
            AfroClip<span className="brand-gradient-text">.ai</span>
          </span>
        </a>

        <div className="flex items-center gap-2">
          {/* Solde de crédits */}
          <div className="flex items-center rounded-full border border-border bg-card soft-shadow">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary disabled:opacity-60"
                aria-label="Actualiser mon solde de crédits"
                title="Actualiser mon solde"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={onRecharge}
              className={`group flex items-center gap-2 rounded-full py-1.5 pr-2 transition-colors hover:opacity-90 ${
                onRefresh ? 'pl-1' : 'pl-3'
              }`}
              aria-label={`Solde : ${credits} crédits. Recharger.`}
            >
              <Coins className="h-4 w-4 text-[var(--orange)]" />
              <span className="text-sm font-bold tabular-nums">{credits}</span>
              <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
                crédit{credits > 1 ? 's' : ''}
              </span>
              <span className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full brand-gradient text-white">
                <Plus className="h-3.5 w-3.5" />
              </span>
            </button>
          </div>

          {user ? (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Ouvrir le menu du compte"
                className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2 soft-shadow transition-colors hover:border-primary/40"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full brand-gradient text-xs font-bold text-white">
                  {user.charAt(0).toUpperCase()}
                </span>
                <span className="hidden max-w-[90px] truncate text-sm font-bold sm:block">
                  {user}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    menuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-border bg-card p-1.5 soft-shadow"
                >
                  <div className="border-b border-border px-3 py-2">
                    <p className="text-xs text-muted-foreground">Connecté en tant que</p>
                    <p className="truncate text-sm font-bold">{user}</p>
                  </div>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      onLogout()
                    }}
                    className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                  >
                    <LogOut className="h-4 w-4 text-[var(--orange)]" />
                    Se déconnecter
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button
                onClick={onLogin}
                className="hidden rounded-full px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:text-primary sm:block"
              >
                Connexion
              </button>
              <button
                onClick={onSignup}
                className="rounded-full brand-gradient px-4 py-2 text-sm font-bold text-white brand-glow transition-transform hover:scale-[1.03]"
              >
                S&apos;inscrire
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
