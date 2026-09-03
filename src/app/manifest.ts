import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const name = process.env.NEXT_PUBLIC_MANDAL_NAME ?? "SGMM Pustak";

  return {
    name: `${name} — SGMM पुस्तक`,
    short_name: "SGMM पुस्तक",
    description: "Vargani receipt management for the mandal.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    // The installed app's splash: the light mesh base, not the old cream.
    background_color: "#e6d0aa",
    theme_color: "#e6d0aa",
    // Marathi is the default language of the installed app.
    lang: "mr-IN",
    dir: "ltr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New receipt", short_name: "New", url: "/dashboard/receipts" },
      { name: "Activity", short_name: "Activity", url: "/dashboard/activity" },
    ],
  };
}
