import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aplikasi Vicmic Service",
    short_name: "Vicmic Service",
    description: "Aplikasi Antrean & Manajemen Servis Laptop Vicmic Indonesia",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4fbf5",
    theme_color: "#2e9e4c",
    orientation: "portrait-primary",
    lang: "id",
    icons: [
      { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
