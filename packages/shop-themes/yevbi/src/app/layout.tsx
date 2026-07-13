import type { Metadata } from 'next';
import '../globals.css';
import '../tokens.css';

export const metadata: Metadata = {
  title: 'YEVBI | Global eSIM Plans',
  description: 'Stay connected anywhere in the world. Get instant eSIM plans for 150+ countries — no physical SIM, no roaming fees.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-mono bg-[#0f0f0f] text-[#bdbdbd] antialiased">{children}</body>
    </html>
  );
}
