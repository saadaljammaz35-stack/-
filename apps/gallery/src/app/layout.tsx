import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Morph Gallery',
  description: 'A photo gallery whose slides dissolve into each other through noise.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
