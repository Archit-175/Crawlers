import Link from 'next/link';
export default function NotFound() {
  return (
    <section className="empty">
      <h1>Page not found</h1>
      <p>This page may have moved, or the address is incorrect.</p>
      <Link className="button primary" href="/">
        Back to workspace
      </Link>
    </section>
  );
}
