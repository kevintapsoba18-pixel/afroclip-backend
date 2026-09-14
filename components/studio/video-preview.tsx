'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Lock, RefreshCw, Loader2 } from 'lucide-react'
import { DEMO_CAPTION, SUBTITLE_STYLES, type ClipResult } from '@/lib/afroclip'

export function VideoPreview({
  clip,
  styleId,
  downloading,
  onDownload,
  onUpgrade,
  onRegenerate,
}: {
  clip: ClipResult
  styleId: string
  downloading: boolean
  onDownload: () => void
  onUpgrade: () => void
  onRegenerate: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [wordIndex, setWordIndex] = useState(0)
  const style = SUBTITLE_STYLES.find((s) => s.id === styleId) ?? SUBTITLE_STYLES[0]

  // Fenêtre de 3 mots qui défile, synchronisée sur la lecture
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    function onTime() {
      const i = Math.floor((v!.currentTime * 1000) / 380) % DEMO_CAPTION.length
      setWordIndex(i)
    }
    v.addEventListener('timeupdate', onTime)
    return () => v.removeEventListener('timeupdate', onTime)
  }, [])

  const start = Math.max(0, wordIndex - 1)
  const visibleWords = DEMO_CAPTION.slice(start, start + 3)

  return (
    <div className="mx-auto w-full max-w-[300px]">
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-3xl bg-black soft-shadow ring-1 ring-border">
        <video
          ref={videoRef}
          key={clip.clipUrl}
          className="h-full w-full object-cover"
          src={clip.clipUrl}
          poster={clip.thumbnail}
          controls
          autoPlay
          muted
          loop
          playsInline
          crossOrigin="anonymous"
        />

        {/* Filigrane obligatoire (aperçu gratuit) */}
        <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 text-2xl font-black text-white/25">
          AfroClip.ai
        </span>
        <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-black/45 px-2 py-1 text-[11px] font-bold text-white/90">
          AfroClip.ai
        </span>

        {/* Sous-titres animés façon TikTok/Reels */}
        <div className="pointer-events-none absolute inset-x-0 bottom-16 flex flex-wrap items-center justify-center gap-x-2 px-4 text-center">
          {visibleWords.map((w, i) => {
            const isActive = start + i === wordIndex
            return (
              <span
                key={`${w}-${start}-${i}`}
                className={`text-xl font-extrabold uppercase tracking-tight [text-shadow:_0_2px_8px_rgba(0,0,0,0.7)] ${
                  isActive ? `${style.activeClass} animate-word-pop` : style.baseClass
                }`}
              >
                {w}
              </span>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 space-y-2.5">
        <button
          onClick={onDownload}
          disabled={downloading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl brand-gradient text-sm font-bold text-white brand-glow transition-transform hover:scale-[1.01] disabled:opacity-70"
        >
          {downloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Téléchargement…
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Télécharger la vidéo MP4
            </>
          )}
        </button>
        <button
          onClick={onUpgrade}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card text-sm font-semibold text-foreground transition-colors hover:border-primary/40"
        >
          <Lock className="h-3.5 w-3.5 text-primary" />
          Passer en HD sans filigrane
        </button>
        <button
          onClick={onRegenerate}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card text-sm font-semibold text-foreground transition-colors hover:border-primary/40"
        >
          <RefreshCw className="h-4 w-4" />
          Générer une autre vidéo
        </button>
      </div>
    </div>
  )
}
