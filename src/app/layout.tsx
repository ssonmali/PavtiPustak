import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Tiro_Devanagari_Marathi } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { WebAnalytics } from "@/components/web-analytics";
import { Toaster } from "@/components/ui/sonner";
import { MobileKeyboard } from "@/components/mobile-keyboard";
import { CustomBackground } from "@/components/custom-background";
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
  /* The address bar, matched to the app. Hexes because meta tags predate CSS:
     these are the TOP of the mesh in each theme, sampled from a render, not
     --primary. Keep them in step by hand.

     A limit before "fixing" the light value: themeColor keys off
     prefers-color-scheme, never the theme CLASS. With Devasthan Day the
     default, the common case is a phone set to light running a dark
     photographic theme, so the light entry carries their near-black. Someone
     who explicitly picks Light gets a bar slightly darker than their page —
     the smaller error, and the only one this API can express. */
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
        /* The Devasthan backdrop, as a CSS variable rather than an <img>: a
           background-image on an unmatched selector is never fetched, so the
           photo costs nothing in the other two themes. A mandal points this at
           its own idol with NEXT_PUBLIC_MANDAP_PHOTO.

           The scrim over this photo is what guarantees text contrast and is
           tuned to the shipped image; a markedly brighter one needs
           --scrim-mid raised. See globals.css. */
        /*
         * Set ONLY when the env override exists. globals.css defaults the two
         * orientations to two different photographs through this variable's
         * own fallback, so writing it unconditionally — even to "/idol.jpg" —
         * left it always defined and those fallbacks could never fire.
         * Undefined is the signal that no override is configured.
         */
        style={
          process.env.NEXT_PUBLIC_MANDAP_PHOTO
            ? {
                ["--mandap-photo" as string]: `url("${process.env.NEXT_PUBLIC_MANDAP_PHOTO}")`,
              }
            : undefined
        }
      >
        <ThemeProvider>
          <MobileKeyboard />
          {/* Overrides the defaults above with the volunteer's own crops, if
              they have chosen a photo. A no-op otherwise — see the component. */}
          <CustomBackground />
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
