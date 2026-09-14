import { NextResponse } from 'next/server'
import { getJobStatus } from '@/lib/clip-store'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params
  const status = getJobStatus(jobId)

  if (!status) {
    return NextResponse.json(
      { error: 'Job introuvable ou expiré. Relance le clipping.' },
      { status: 404 },
    )
  }

  return NextResponse.json(status)
}
