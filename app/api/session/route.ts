import { route } from '@/server/api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = route('session.get');
export const POST = route('session.login');
export const DELETE = route('session.logout');
