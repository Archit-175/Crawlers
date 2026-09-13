'use client';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="empty">
      <h1>Something went wrong</h1>
      <p>Your saved research is still on the server.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
