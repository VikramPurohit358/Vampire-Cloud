import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-vamp-bg px-6 text-center text-vamp-text antialiased">
      <div className="max-w-md rounded-3xl border border-vamp-border bg-vamp-surface p-8 shadow-xl">
        <span className="text-5xl" aria-hidden="true">🌑</span>
        <h2 className="mt-4 font-serif text-3xl font-semibold text-vamp-text">
          404 — Not Found
        </h2>
        <p className="mt-2 text-sm text-vamp-muted">
          The requested page does not exist in Vampire Cloud.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-vamp-red px-5 py-2.5 text-sm font-medium text-white transition hover:bg-vamp-red-soft active:scale-95"
        >
          Return to Dashboard
        </Link>
      </div>
    </main>
  );
}
