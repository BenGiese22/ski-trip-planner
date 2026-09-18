import type { Metadata, Viewport } from "next";
import { Zilla_Slab, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const zillaSlab = Zilla_Slab({
  variable: "--font-zilla-slab",
  weight: ["400", "600", "700"],
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Colorado ski trip planner",
  description: "Trip interest and scheduling check for a Colorado ski weekend.",
};

// viewportFit: "cover" is what makes the safe-area-inset-* env() vars resolve
// to the notch/home-indicator size on iOS instead of 0 — the sticky SaveBar
// needs that to pad above the home indicator rather than sitting under it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${zillaSlab.variable} ${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-snow text-ink font-sans">
        {children}
      </body>
    </html>
  );
}
