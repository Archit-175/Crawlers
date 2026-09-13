import { Library } from '@/components/Library';
import { getLibrary } from '@/server/library';
export const metadata = { title: 'Forest atlas' };
export default function Page() {
  return <Library initialData={getLibrary()} />;
}
