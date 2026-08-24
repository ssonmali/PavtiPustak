import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Tiro_Devanagari_Marathi } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { WebAnalytics } from "@/components/web-analytics";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Display face for headings and the mandal's name. Chosen because it covers
 * Devanagari properly — most display fonts do not, and Marathi headings fall
 * back to a mismatched system face.
 */
const tiro = Tiro_Devanagari_Marathi({
  variable: "--font-display",
  weight: "400",
  subsets: ["devanagari", "latin"],
  display: "swap",
});

/** Zoom stays enabled — pinch-to-zoom is an accessibility affordance. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#d97706" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  title: "SGMM Pustak",
  description: "Vargani receipt management for the mandal.",
  appleWebApp: { capable: true, title: "SGMM Pustak", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${tiro.variable} h-full antialiased`}
    >
      <body className="app-surface flex min-h-full flex-col">
        <ThemeProvider>
          {children}
          <Toaster
            position="top-center"
            // Default is a fixed 356px, which overflows a 320px screen.
            style={{ ["--width" as string]: "min(356px, calc(100vw - 1.5rem))" }}
          />
        </ThemeProvider>
        {/* Page views and Core Web Vitals. Both scripts are served from this
            origin, so neither is a third-party request. */}
        <WebAnalytics />
      </body>
    </html>
  );
}
