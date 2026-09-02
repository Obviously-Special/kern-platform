import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import KernMount from '@/components/KernMount';

export const metadata: Metadata = {
  title: 'Bergblick Adventures — Guided mountain experiences',
  description:
    'Guided hikes, tandem paragliding, e-bike tours and climbing courses in the Swiss Alps. Book your mountain adventure online.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="min-h-[70vh]">{children}</main>
        <Footer />
        <KernMount />
      </body>
    </html>
  );
}
