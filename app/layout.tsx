import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { BRAND } from '@/lib/branding';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  title: `${BRAND.publicName} — Vérifiez vos partenariats avec Mia`,
  description: BRAND.tagline,
  metadataBase: new URL(`https://${BRAND.domain}`),
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
