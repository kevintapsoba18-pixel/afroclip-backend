import Link from 'next/link'

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-extrabold tracking-tight">Lien de confirmation invalide</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Ce lien a expiré ou a déjà été utilisé. Reviens à l&apos;accueil et connecte-toi à nouveau.
      </p>
      <Link
        href="/"
        className="rounded-2xl brand-gradient px-5 py-3 text-sm font-bold text-white brand-glow"
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  )
}
