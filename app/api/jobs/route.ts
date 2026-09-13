import { route } from '@/server/api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = route('jobs.list');
export const POST = route('jobs.create');
