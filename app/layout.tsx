import type { Metadata, Viewport } from 'next';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/space-grotesk/latin-700.css';
import { BRAND } from '@/lib/branding';
import { publicSiteUrl } from '@/lib/site-url';
import './globals.css';

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export const metadata: Metadata = {
  title: `${BRAND.publicName} — Vérifiez vos partenariats avec Mia`,
  description: 'MentionCheck aide les créateurs et influenceurs à vérifier les mentions commerciales de leurs publications avec Mia, avant publication.',
  alternates: { canonical: '/' },
  metadataBase: new URL(publicSiteUrl()),
  openGraph: {
    type:'website',locale:'fr_FR',siteName:BRAND.publicName,
    title:'MentionCheck — vérifier les mentions commerciales',
    description:'Vérifiez les mentions commerciales de vos publications avec Mia, avant publication.',
    url: '/',
  },
  twitter: { card:'summary', title:BRAND.publicName, description:'Vérifiez les mentions commerciales de vos publications avec Mia.' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
