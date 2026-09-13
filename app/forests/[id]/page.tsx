import { Library } from '@/components/Library';
import { getLibrary } from '@/server/library';
import { notFound } from 'next/navigation';
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forest = getLibrary().forests.find((f) => f.id === id);
  return { title: forest?.title ?? 'Forest not found', description: forest?.subtitle };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const library = getLibrary();
  if (!library.forests.some((f) => f.id === id)) notFound();
  return <Library key={id} articleId={id} initialData={library} />;
}
