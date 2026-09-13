'use client';
import { useQuery } from '@tanstack/react-query';
import type { Job } from '@/shared/types';
import { api } from './api';
import { Dashboard } from './Dashboard';
import { ErrorBox, Loading } from './components';
import { useWorkspace } from './WorkspaceShell';
export function DashboardPage({ history = false }: { history?: boolean }) {
  const { openNewCrawl } = useWorkspace();
  const jobs = useQuery({
    queryKey: ['jobs'],
    queryFn: () => api<{ items: Job[] }>('/jobs'),
    refetchInterval: 15000,
  });
  if (jobs.isPending) return <Loading />;
  if (jobs.error) return <ErrorBox error={jobs.error} />;
  return <Dashboard jobs={jobs.data.items} onNew={openNewCrawl} history={history} />;
}
