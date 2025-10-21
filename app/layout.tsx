import type { Metadata } from 'next';
import Providers from '@/components/providers';

export const metadata: Metadata = {
  title: 'Flappy Mini',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
      </head>
      <body style={{ margin: 0, height: '100dvh', overflow: 'hidden', background: '#0a0713', color: '#fff' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
