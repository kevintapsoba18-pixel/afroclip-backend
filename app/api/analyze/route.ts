import { NextResponse } from 'next/server'

// Extrait l'identifiant d'une vidéo YouTube depuis les formats courants
// (watch?v=, youtu.be/, shorts/, live/, embed/)
function extractVideoId(raw: string): string | null {
  const url = raw.trim()
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{6,})/i,
    /(?:youtu\.be\/)([\w-]{6,})/i,
    /(?:youtube\.com\/(?:shorts|live|embed)\/)([\w-]{6,})/i,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m?.[1]) return m[1]
  }
  return null
}

export async function POST(request: Request) {
  let body: { url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  const url = (body.url ?? '').trim()
  if (!url) {
    return NextResponse.json({ error: 'Colle un lien YouTube pour commencer.' }, { status: 400 })
  }

  const videoId = extractVideoId(url)
  if (!videoId) {
    return NextResponse.json(
      { error: 'Ce lien ne ressemble pas à une vidéo YouTube (youtube.com ou youtu.be).' },
      { status: 422 },
    )
  }

  // oEmbed public de YouTube : titre, chaîne et miniature, sans clé API.
  const canonical = `https://www.youtube.com/watch?v=${videoId}`
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(canonical)}&format=json`,
      { headers: { 'User-Agent': 'AfroClip.ai' }, cache: 'no-store' },
    )

    if (!res.ok) {
      return NextResponse.json(
        { error: "Vidéo introuvable ou privée. Vérifie que le lien est public." },
        { status: 404 },
      )
    }

    const data = (await res.json()) as {
      title: string
      author_name: string
      thumbnail_url: string
    }

    return NextResponse.json({
      videoId,
      title: data.title,
      author: data.author_name,
      // miniature haute résolution
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      fallbackThumbnail: data.thumbnail_url,
    })
  } catch {
    return NextResponse.json(
      { error: "Impossible d'analyser la vidéo pour le moment. Réessaie." },
      { status: 502 },
    )
  }
}
