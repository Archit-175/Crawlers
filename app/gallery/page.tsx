import { Gallery } from '@/components/Gallery';
import { getLibrary } from '@/server/library';
export const metadata = { title: 'Nature gallery' };
export default function Page() {
  return <Gallery images={getLibrary().gallery} />;
}
