import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Providers } from '@/components/Providers';
import { WorkspaceShell } from '@/components/WorkspaceShell';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'Crawlers — Web Wonders', template: '%s | Crawlers' },
  description: 'Explore the world’s forests and collect structured research from public websites.',
};
export const viewport: Viewport = { themeColor: '#1e392c' };
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.dataset.theme=localStorage.getItem('crawlers-theme')==='dark'?'dark':'light'}catch{}",
          }}
        />
        <Providers>
          <WorkspaceShell>{children}</WorkspaceShell>
        </Providers>
      </body>
    </html>
  );
}
