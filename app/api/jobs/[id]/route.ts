import { route } from '@/server/api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = route('jobs.get');
export const DELETE = route('jobs.delete');
