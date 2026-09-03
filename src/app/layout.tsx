import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Tiro_Devanagari_Marathi } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { WebAnalytics } from "@/components/web-analytics";
import { Toaster } from "@/components/ui/sonner";
import { MobileKeyboard } from "@/components/mobile-keyboard";
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
  /* The browser's own chrome, so the address bar matches the app rather than
     the palette this replaced. Hexes because the manifest and meta tags
     predate CSS: these are the TOP of the mesh in each theme, sampled from a
     render, not --primary. A copper bar above a violet ground read as a
     stripe of a different app. Keep them in step by hand.

     A limit worth knowing before "fixing" the light value: themeColor can
     only key off prefers-color-scheme, never the app's theme CLASS. Since
     Devasthan Day became the default (see theme-provider.tsx) the common case
     is a phone set to light running a dark, photographic theme — the old
     #e6d0aa put a pale sand bar above it. Both Devasthan themes are dark, so
     the light entry now carries the warm near-black at the top of their
     scrim. Someone who explicitly picks Light gets a bar slightly darker than
     their page; that is the smaller error, and the only one this API can
     express. Making it exact needs a client-side <meta> swap on theme
     change. */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1a1410" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1527" },
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
      <body
        className="app-surface flex min-h-full flex-col"
        /* The Devasthan themes' backdrop, as a CSS variable rather than an
           <img>: it is a decorative ground, and a background-image on a
           selector that does not match is never fetched, so the photo costs
           nothing in the other two themes. A mandal points this at its own
           idol by setting NEXT_PUBLIC_MANDAP_PHOTO; the fallback is the same
           file the header already shows.

           Worth knowing before changing it: the scrim over this photo is what
           guarantees text contrast, and it is tuned to the shipped image. A
           markedly brighter photo needs --scrim-mid raised — see the
           Devasthan block in globals.css. */
        style={{
          ["--mandap-photo" as string]: `url("${
            process.env.NEXT_PUBLIC_MANDAP_PHOTO ?? "/idol.jpg"
          }")`,
        }}
      >
        <ThemeProvider>
          <MobileKeyboard />
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
