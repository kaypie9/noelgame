// app/layout.tsx
import Providers from '@/components/providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0a0713', color: '#fff' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
