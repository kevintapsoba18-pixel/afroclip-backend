'use client'

import { Clock, Film, Play } from 'lucide-react'
import type { ClipResult } from '@/lib/afroclip'

export function Dashboard({
  history,
  onOpen,
}: {
  history: ClipResult[]
  onOpen: (clip: ClipResult) => void
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-6 flex items-center gap-2">
        <Film className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-extrabold tracking-tight">Mes vidéos générées</h2>
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card px-6 py-14 text-center soft-shadow">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary">
            <Film className="h-7 w-7" />
          </span>
          <p className="font-bold">Aucune vidéo pour l&apos;instant</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Colle un lien YouTube ci-dessus et génère ton premier Short viral. Il apparaîtra ici.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {history.map((clip, i) => (
            <button
              key={`${clip.clipUrl}-${i}`}
              onClick={() => onOpen(clip)}
              className="group overflow-hidden rounded-2xl border border-border bg-card text-left soft-shadow transition-transform hover:-translate-y-1"
            >
              <div className="relative aspect-[9/16] w-full overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={clip.thumbnail || '/placeholder.svg?height=320&width=180&query=short+video'}
                  alt=""
                  crossOrigin="anonymous"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-primary shadow-md">
                    <Play className="h-4 w-4" fill="currentColor" />
                  </span>
                </span>
              </div>
              <div className="p-2.5">
                <p className="truncate text-sm font-semibold">{clip.title ?? 'Clip AfroClip'}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {clip.duration ?? 'Short vertical'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
