import { NextResponse } from 'next/server'
import { createJob } from '@/lib/clip-store'

export async function POST(request: Request) {
  let body: {
    videoId?: string
    title?: string
    author?: string
    thumbnail?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  const videoId = (body.videoId ?? '').trim()
  if (!videoId) {
    return NextResponse.json(
      { error: 'Analyse une vidéo YouTube avant de lancer le clipping.' },
      { status: 400 },
    )
  }

  const jobId = createJob({
    videoId,
    videoTitle: (body.title ?? 'Ta vidéo').trim(),
    author: (body.author ?? '').trim(),
    thumbnail: (body.thumbnail ?? '').trim(),
  })

  return NextResponse.json({ jobId })
}
