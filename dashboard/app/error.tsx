'use client';

import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Dashboard runtime error:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-vamp-bg px-6 text-center text-vamp-text antialiased">
      <div className="max-w-md rounded-3xl border border-vamp-border bg-vamp-surface p-8 shadow-xl">
        <span className="text-5xl" aria-hidden="true">🦇</span>
        <h2 className="mt-4 font-serif text-2xl font-semibold text-vamp-text">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-vamp-muted">
          {error.message || 'An unexpected error occurred while rendering the Vampire Cloud dashboard.'}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-xl bg-vamp-red px-5 py-2.5 text-sm font-medium text-white transition hover:bg-vamp-red-soft active:scale-95"
        >
          Try Again
        </button>
      </div>
    </main>
  );
}
