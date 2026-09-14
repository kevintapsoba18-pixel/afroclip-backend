// Store de jobs de clipping en mémoire (process unique).
// La progression est calculée à partir du temps écoulé : pas de minuterie,
// chaque lecture du statut recalcule l'étape et le pourcentage.

export type ClipStage = {
  key: string
  label: string
  // fin cumulée de l'étape, en fraction de la durée totale (0 → 1)
  until: number
}

export const STAGES: ClipStage[] = [
  { key: 'download', label: 'Téléchargement de la vidéo', until: 0.15 },
  { key: 'analyze', label: 'Analyse IA des moments forts', until: 0.42 },
  { key: 'cut', label: 'Découpage des meilleurs clips', until: 0.66 },
  { key: 'subtitles', label: 'Génération des sous-titres', until: 0.86 },
  { key: 'finalize', label: 'Finalisation & export vertical', until: 1 },
]

// Durée simulée du traitement (ms) — court pour une démo réactive.
const PROCESS_MS = 9000

export type Clip = {
  id: string
  title: string
  start: string
  duration: string
  viralityScore: number
  caption: string
  thumbnail: string
}

export type ClipJob = {
  id: string
  videoId: string
  videoTitle: string
  author: string
  thumbnail: string
  createdAt: number
  clips: Clip[]
}

type JobStatus = {
  id: string
  status: 'processing' | 'done'
  progress: number
  stageKey: string
  stageLabel: string
  stageIndex: number
  totalStages: number
  clips: Clip[]
  videoTitle: string
}

// Persiste le Map entre les rechargements Fast Refresh en dev.
const globalStore = globalThis as unknown as { __afroclipJobs?: Map<string, ClipJob> }
const jobs: Map<string, ClipJob> = globalStore.__afroclipJobs ?? new Map()
globalStore.__afroclipJobs = jobs

function seconds(total: number) {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Génère des clips plausibles et déterministes à partir de la vidéo.
function buildClips(videoId: string, title: string): Clip[] {
  const angles = [
    { title: 'Le hook des 3 premières secondes', caption: 'Ce début va te scotcher 👀' },
    { title: 'Le moment qui fait réagir', caption: 'Personne ne s\'y attendait…' },
    { title: 'La punchline à partager', caption: 'À envoyer à un pote maintenant' },
    { title: 'Le conseil qui change tout', caption: 'Note ça quelque part 📌' },
  ]
  let cursor = 12
  return angles.map((a, i) => {
    const start = cursor + i * 47
    const dur = 22 + ((videoId.charCodeAt(i % videoId.length) + i * 7) % 20)
    cursor = start
    return {
      id: `${videoId}-${i}`,
      title: a.title,
      start: seconds(start),
      duration: `0:${dur.toString().padStart(2, '0')}`,
      viralityScore: 78 + ((videoId.charCodeAt((i + 2) % videoId.length) + i * 13) % 20),
      caption: a.caption,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    }
  })
}

export function createJob(input: {
  videoId: string
  videoTitle: string
  author: string
  thumbnail: string
}): string {
  const id = `job_${Math.random().toString(36).slice(2, 10)}`
  jobs.set(id, {
    id,
    videoId: input.videoId,
    videoTitle: input.videoTitle,
    author: input.author,
    thumbnail: input.thumbnail,
    createdAt: Date.now(),
    clips: buildClips(input.videoId, input.videoTitle),
  })
  return id
}

export function getJobStatus(id: string): JobStatus | null {
  const job = jobs.get(id)
  if (!job) return null

  const elapsed = Date.now() - job.createdAt
  const fraction = Math.min(elapsed / PROCESS_MS, 1)
  const done = fraction >= 1

  const stageIndex = STAGES.findIndex((s) => fraction <= s.until)
  const idx = stageIndex === -1 ? STAGES.length - 1 : stageIndex
  const stage = STAGES[idx]

  return {
    id: job.id,
    status: done ? 'done' : 'processing',
    progress: Math.round(fraction * 100),
    stageKey: stage.key,
    stageLabel: done ? 'Clips prêts !' : stage.label,
    stageIndex: idx,
    totalStages: STAGES.length,
    clips: done ? job.clips : [],
    videoTitle: job.videoTitle,
  }
}
