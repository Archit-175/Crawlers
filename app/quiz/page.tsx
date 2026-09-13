import { Quiz } from '@/components/Library';
import { getLibrary } from '@/server/library';
export const metadata = { title: 'Forest knowledge quiz' };
export default function Page() { return <Quiz initialData={getLibrary()} />; }
