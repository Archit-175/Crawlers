import { CrawlView } from '@/components/CrawlView';
import { z } from 'zod';
import { notFound } from 'next/navigation';
export const metadata = { title: 'Crawl details' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  return <CrawlView key={id} id={id} />;
}
