import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Little Post — Something lovely has arrived",
  description: "A little place for letters, memories, and the things worth sending.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
